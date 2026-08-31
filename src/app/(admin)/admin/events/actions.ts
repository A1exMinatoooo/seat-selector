"use server";

import { and, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  adminActionError,
  adminActionSuccess,
  type AdminActionState,
} from "@/features/admin/admin-action-state";
import { eventConfigurationInputSchema, eventInputSchema } from "@/features/events/schemas";
import { getDb } from "@/server/db/client";
import {
  eventAuditLogs,
  consecutiveCheckinLinks,
  consecutiveCheckinWorkflowEvents,
  consecutiveCheckinWorkflows,
  eventSeats,
  events,
  halls,
  lotteryPrizes,
  participants,
  participantTickets,
  reservationSeats,
  seats,
  ticketTypes,
} from "@/server/db/schema";
import {
  consecutiveTargetViolation,
  type ConsecutiveEventConfiguration,
} from "@/server/domain/consecutive-checkin-config";
import {
  describeAvailabilityChange,
  resolveEventAvailability,
} from "@/server/domain/event-seat-availability";
import {
  canChangeEventStatus,
  hasSufficientLotteryPool,
  lotteryPoolSize,
} from "@/server/domain/event-status";
import { requireAdmin } from "@/server/security/admin-session";
import { randomToken } from "@/server/security/crypto";
import { DomainError, errorCodes } from "@/shared/errors";

function parseJsonFormField(formData: FormData, name: string): unknown {
  const value = formData.get(name);
  if (typeof value !== "string") return [];
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new DomainError(errorCodes.validation, `${name} 数据无效`);
  }
}

const consecutiveConfigurationSchema = z
  .object({
    id: z.string().uuid(),
    enabled: z.preprocess(
      (value) => value === true || value === "on" || value === "true",
      z.boolean(),
    ),
    targetEventIds: z.array(z.string().uuid()).max(20),
  })
  .superRefine((input, context) => {
    if (input.enabled && input.targetEventIds.length === 0)
      context.addIssue({
        code: "custom",
        path: ["targetEventIds"],
        message: "开启连签时至少选择一个活动",
      });
    if (new Set(input.targetEventIds).size !== input.targetEventIds.length)
      context.addIssue({ code: "custom", path: ["targetEventIds"], message: "活动不能重复" });
  });

function eventConfigurationRow(row: {
  id: string;
  name: string;
  status: "draft" | "open" | "ended";
  participationMode: "onsite" | "preregistered";
  startsAt: Date;
  timeZone: string;
  locationId: string;
}): ConsecutiveEventConfiguration {
  return row;
}

export async function updateConsecutiveCheckinAction(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdmin();
  let parsed: ReturnType<typeof consecutiveConfigurationSchema.safeParse>;
  try {
    parsed = consecutiveConfigurationSchema.safeParse({
      ...Object.fromEntries(formData),
      targetEventIds: parseJsonFormField(formData, "targetEventIds"),
    });
  } catch {
    return adminActionError("连签设置无效，请刷新后重试。", "INVALID_CONSECUTIVE_CONFIGURATION");
  }
  if (!parsed.success)
    return adminActionError(
      "连签设置无效，请至少选择一个符合条件的活动。",
      "INVALID_CONSECUTIVE_CONFIGURATION",
    );

  try {
    await getDb().transaction(async (tx) => {
      const [source] = await tx
        .select({
          id: events.id,
          name: events.name,
          status: events.status,
          participationMode: events.participationMode,
          startsAt: events.startsAt,
          timeZone: events.timeZone,
          locationId: events.locationId,
        })
        .from(events)
        .where(eq(events.id, parsed.data.id))
        .limit(1)
        .for("update");
      if (!source) throw new DomainError(errorCodes.notFound, "活动不存在", 404);
      if (source.status === "ended" || source.participationMode !== "onsite")
        throw new DomainError(
          errorCodes.eventConflict,
          "只有未结束的现场发行活动可以配置连签",
          409,
        );

      const targetIds = parsed.data.enabled ? parsed.data.targetEventIds : [];
      const targets = targetIds.length
        ? await tx
            .select({
              id: events.id,
              name: events.name,
              status: events.status,
              participationMode: events.participationMode,
              startsAt: events.startsAt,
              timeZone: events.timeZone,
              locationId: events.locationId,
            })
            .from(events)
            .where(inArray(events.id, targetIds))
            .for("update")
        : [];
      if (targets.length !== targetIds.length)
        throw new DomainError(errorCodes.validation, "部分连签活动不存在", 400);
      for (const target of targets) {
        if (target.id === source.id || consecutiveTargetViolation(source, target))
          throw new DomainError(errorCodes.eventConflict, `${target.name} 不再符合连签条件`, 409);
      }

      await tx
        .delete(consecutiveCheckinLinks)
        .where(eq(consecutiveCheckinLinks.sourceEventId, source.id));
      if (targets.length)
        await tx
          .insert(consecutiveCheckinLinks)
          .values(
            targets.map((target) => ({ sourceEventId: source.id, targetEventId: target.id })),
          );
      await tx.insert(eventAuditLogs).values({
        eventId: source.id,
        action: "consecutive_checkin_configuration_changed",
        details: {
          enabled: targets.length > 0,
          targets: targets
            .sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime())
            .map((target) => ({ id: target.id, name: target.name })),
        },
      });
    });
  } catch (error) {
    if (error instanceof DomainError) return adminActionError(error.message, error.code);
    console.error(
      JSON.stringify({
        level: "error",
        message: "consecutive_checkin_configuration_save_failed",
        eventId: parsed.data.id,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    );
    return adminActionError(
      "连签设置保存失败，请稍后重试。",
      "CONSECUTIVE_CONFIGURATION_SAVE_FAILED",
    );
  }
  revalidatePath(`/admin/events/${parsed.data.id}`);
  return adminActionSuccess("连签设置已保存。", "CONSECUTIVE_CONFIGURATION_SAVED");
}

export async function createEventAction(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdmin();
  let input: z.infer<typeof eventInputSchema>;
  try {
    input = eventInputSchema.parse({
      ...Object.fromEntries(formData),
      ticketTypes: parseJsonFormField(formData, "ticketTypes"),
      prizes: parseJsonFormField(formData, "prizes"),
      availableSeatIds: parseJsonFormField(formData, "availableSeatIds"),
    });
  } catch {
    return adminActionError("活动信息无效，请检查后重试。", "INVALID_EVENT");
  }
  let eventId: string;
  try {
    eventId = await getDb().transaction(async (tx) => {
      const [hall] = await tx
        .select({ id: halls.id })
        .from(halls)
        .where(and(eq(halls.id, input.hallId), isNull(halls.archivedAt)))
        .limit(1)
        .for("share");
      if (!hall) throw new Error("Hall template is no longer active");
      const hallSeats = await tx
        .select({ id: seats.id, kind: seats.kind, templateSelectable: seats.selectable })
        .from(seats)
        .where(eq(seats.hallId, input.hallId));
      const availableSeatIds = resolveEventAvailability(hallSeats, input.availableSeatIds);
      const [created] = await tx
        .insert(events)
        .values({
          publicCode: randomToken(18),
          name: input.name,
          hallId: input.hallId,
          locationId: input.locationId,
          radiusMeters: input.radiusMeters,
          startsAt: input.startsAt,
          timeZone: input.timeZone,
          locationCheckEnabled: input.locationCheckEnabled,
          lotteryEnabled: input.lotteryEnabled,
          lotteryPoolBonus: input.lotteryPoolBonus,
          participationMode: input.participationMode,
          maxTicketsPerIssue: input.maxTicketsPerIssue,
          expectedLotteryTickets: input.lotteryEnabled
            ? (input.expectedLotteryTickets ?? null)
            : null,
        })
        .returning({ id: events.id });
      if (!created) throw new Error("Event creation did not return an id");
      if (availableSeatIds.length)
        await tx
          .insert(eventSeats)
          .values(availableSeatIds.map((seatId) => ({ eventId: created.id, seatId })));
      await tx.insert(ticketTypes).values(
        input.ticketTypes.map((type, sortOrder) => ({
          eventId: created.id,
          name: type.name,
          lotteryEligible: type.lotteryEligible,
          sortOrder,
        })),
      );
      if (input.lotteryEnabled)
        await tx
          .insert(lotteryPrizes)
          .values(
            input.prizes.map((prize, sortOrder) => ({ eventId: created.id, ...prize, sortOrder })),
          );
      await tx.insert(eventAuditLogs).values({
        eventId: created.id,
        action: "event_created",
        details: {
          ticketTypeCount: input.ticketTypes.length,
          locationCheckEnabled: input.locationCheckEnabled,
          lotteryEnabled: input.lotteryEnabled,
          prizeCount: input.prizes.length,
        },
      });
      return created.id;
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "event_create_failed",
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    );
    return adminActionError("活动草稿保存失败，请稍后重试。", "EVENT_CREATE_FAILED");
  }
  revalidatePath("/admin/events");
  redirect(`/admin/events/${eventId}?notice=event-draft-saved`);
}

export async function updateEventConfigurationAction(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdmin();
  let input: z.infer<typeof eventConfigurationInputSchema>;
  try {
    input = eventConfigurationInputSchema.parse({
      ...Object.fromEntries(formData),
      ticketTypes: parseJsonFormField(formData, "ticketTypes"),
      prizes: parseJsonFormField(formData, "prizes"),
    });
  } catch {
    return adminActionError("活动设置无效，请检查后重试。", "INVALID_EVENT_CONFIGURATION");
  }

  try {
    await getDb().transaction(async (tx) => {
      const [event] = await tx
        .select({
          id: events.id,
          name: events.name,
          status: events.status,
          participationMode: events.participationMode,
          startsAt: events.startsAt,
          timeZone: events.timeZone,
          locationId: events.locationId,
        })
        .from(events)
        .where(eq(events.id, input.id))
        .limit(1)
        .for("update");
      if (!event) throw new DomainError(errorCodes.notFound, "活动不存在", 404);
      if (event.status !== "draft")
        throw new DomainError(errorCodes.eventConflict, "只有草稿活动可以修改配置", 409);
      if (event.participationMode !== input.participationMode) {
        const [existingParticipant] = await tx
          .select({ id: participants.id })
          .from(participants)
          .where(eq(participants.eventId, input.id))
          .limit(1);
        if (existingParticipant)
          throw new DomainError(errorCodes.eventConflict, "已有参与者，不能切换参与方式", 409);
      }

      const affectedLinks = await tx
        .select({
          sourceEventId: consecutiveCheckinLinks.sourceEventId,
          targetEventId: consecutiveCheckinLinks.targetEventId,
        })
        .from(consecutiveCheckinLinks)
        .where(
          or(
            eq(consecutiveCheckinLinks.sourceEventId, input.id),
            eq(consecutiveCheckinLinks.targetEventId, input.id),
          ),
        );
      if (affectedLinks.length) {
        const relatedIds = [
          ...new Set(affectedLinks.flatMap((link) => [link.sourceEventId, link.targetEventId])),
        ].filter((id) => id !== input.id);
        const related = relatedIds.length
          ? await tx
              .select({
                id: events.id,
                name: events.name,
                status: events.status,
                participationMode: events.participationMode,
                startsAt: events.startsAt,
                timeZone: events.timeZone,
                locationId: events.locationId,
              })
              .from(events)
              .where(inArray(events.id, relatedIds))
          : [];
        const proposed = eventConfigurationRow({
          ...event,
          name: input.name,
          participationMode: input.participationMode,
          startsAt: input.startsAt,
          timeZone: input.timeZone,
          locationId: input.locationId,
        });
        const byId = new Map(related.map((row) => [row.id, eventConfigurationRow(row)]));
        byId.set(input.id, proposed);
        for (const link of affectedLinks) {
          const source = byId.get(link.sourceEventId);
          const target = byId.get(link.targetEventId);
          if (!source || !target || consecutiveTargetViolation(source, target))
            throw new DomainError(
              errorCodes.eventConflict,
              `当前修改会使“${source?.name ?? "未知活动"}”的连签关系失效，请先解除关联`,
              409,
            );
        }
      }

      const existingTypes = await tx
        .select({ id: ticketTypes.id })
        .from(ticketTypes)
        .where(eq(ticketTypes.eventId, input.id));
      const existingTypeIds = new Set(existingTypes.map((type) => type.id));
      const retainedTypeIds = new Set(
        input.ticketTypes.flatMap((type) => (type.id ? [type.id] : [])),
      );
      if ([...retainedTypeIds].some((id) => !existingTypeIds.has(id)))
        throw new DomainError(errorCodes.validation, "票种数据无效");
      const removedTypeIds = existingTypes
        .map((type) => type.id)
        .filter((id) => !retainedTypeIds.has(id));
      if (removedTypeIds.length) {
        const [usedType] = await tx
          .select({ id: participantTickets.ticketTypeId })
          .from(participantTickets)
          .where(inArray(participantTickets.ticketTypeId, removedTypeIds))
          .limit(1);
        if (usedType)
          throw new DomainError(errorCodes.eventConflict, "已有参与者使用该票种，不能移除", 409);
        await tx.delete(ticketTypes).where(inArray(ticketTypes.id, removedTypeIds));
      }

      for (const type of input.ticketTypes) {
        if (type.id)
          await tx
            .update(ticketTypes)
            .set({ name: `__editing__${type.id}` })
            .where(and(eq(ticketTypes.id, type.id), eq(ticketTypes.eventId, input.id)));
      }
      for (const [sortOrder, type] of input.ticketTypes.entries()) {
        if (type.id)
          await tx
            .update(ticketTypes)
            .set({ name: type.name, lotteryEligible: type.lotteryEligible, sortOrder })
            .where(and(eq(ticketTypes.id, type.id), eq(ticketTypes.eventId, input.id)));
        else
          await tx.insert(ticketTypes).values({
            eventId: input.id,
            name: type.name,
            lotteryEligible: type.lotteryEligible,
            sortOrder,
          });
      }

      await tx.delete(lotteryPrizes).where(eq(lotteryPrizes.eventId, input.id));
      if (input.lotteryEnabled)
        await tx
          .insert(lotteryPrizes)
          .values(
            input.prizes.map((prize, sortOrder) => ({ eventId: input.id, ...prize, sortOrder })),
          );
      await tx
        .update(events)
        .set({
          name: input.name,
          locationId: input.locationId,
          radiusMeters: input.radiusMeters,
          startsAt: input.startsAt,
          timeZone: input.timeZone,
          locationCheckEnabled: input.locationCheckEnabled,
          lotteryEnabled: input.lotteryEnabled,
          lotteryPoolBonus: input.lotteryPoolBonus,
          participationMode: input.participationMode,
          maxTicketsPerIssue: input.maxTicketsPerIssue,
          expectedLotteryTickets: input.lotteryEnabled
            ? (input.expectedLotteryTickets ?? null)
            : null,
          version: sql`${events.version} + 1`,
        })
        .where(eq(events.id, input.id));
      await tx.insert(eventAuditLogs).values({
        eventId: input.id,
        action: "event_configuration_changed",
        details: {
          ticketTypeCount: input.ticketTypes.length,
          locationCheckEnabled: input.locationCheckEnabled,
          lotteryEnabled: input.lotteryEnabled,
          lotteryPoolBonus: input.lotteryPoolBonus,
          prizeCount: input.prizes.length,
        },
      });
    });
  } catch (error) {
    if (error instanceof DomainError) return adminActionError(error.message, error.code);
    console.error(
      JSON.stringify({
        level: "error",
        message: "event_configuration_save_failed",
        eventId: input.id,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    );
    return adminActionError("活动设置保存失败，请稍后重试。", "EVENT_CONFIGURATION_SAVE_FAILED");
  }
  revalidatePath("/admin/events");
  revalidatePath(`/admin/events/${input.id}`);
  return adminActionSuccess("活动设置已保存。", "EVENT_CONFIGURATION_SAVED");
}

const eventAvailabilityInputSchema = z
  .object({
    id: z.string().uuid(),
    availableSeatIds: z
      .string()
      .transform((value, context) => {
        try {
          return JSON.parse(value) as unknown;
        } catch {
          context.addIssue({ code: "custom", message: "座位范围数据无效" });
          return z.NEVER;
        }
      })
      .pipe(z.array(z.string().uuid()).max(2500)),
    lockedSeatHalf: z.preprocess(
      (value) => (value === "" || value === undefined ? null : value),
      z.enum(["left", "right"]).nullable(),
    ),
    changeSource: z
      .enum([
        "manual",
        "half_lock",
        "half_unlock",
        "half_switch",
        "quick_count",
        "rectangle_add",
        "rectangle_toggle",
      ])
      .default("manual"),
    side: z.enum(["left", "right"]).optional(),
  })
  .superRefine((input, context) => {
    if (input.changeSource.startsWith("half_") && !input.side)
      context.addIssue({ code: "custom", path: ["side"], message: "半场方向缺失" });
  });

export type SeatAvailabilitySaveState = AdminActionState;

export async function updateEventSeatsAction(
  _previousState: SeatAvailabilitySaveState,
  formData: FormData,
): Promise<SeatAvailabilitySaveState> {
  await requireAdmin();
  const parsed = eventAvailabilityInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return adminActionError(
      "座位开放范围数据无效，请刷新页面后重试。",
      "INVALID_SEAT_AVAILABILITY",
    );
  const input = parsed.data;
  try {
    await getDb().transaction(async (tx) => {
      const [event] = await tx
        .select({
          hallId: events.hallId,
          status: events.status,
          lockedSeatHalf: events.lockedSeatHalf,
        })
        .from(events)
        .where(eq(events.id, input.id))
        .limit(1)
        .for("update");
      if (!event || event.status === "ended") throw new Error("活动不存在或已结束");
      const [hallSeats, currentAvailable, reserved] = await Promise.all([
        tx
          .select({ id: seats.id, kind: seats.kind, templateSelectable: seats.selectable })
          .from(seats)
          .where(eq(seats.hallId, event.hallId)),
        tx
          .select({ seatId: eventSeats.seatId })
          .from(eventSeats)
          .where(eq(eventSeats.eventId, input.id)),
        tx
          .select({ seatId: reservationSeats.seatId })
          .from(reservationSeats)
          .where(eq(reservationSeats.eventId, input.id)),
      ]);
      const availableSeatIds = resolveEventAvailability(
        hallSeats,
        input.availableSeatIds,
        reserved.map((item) => item.seatId),
      );
      await tx.delete(eventSeats).where(eq(eventSeats.eventId, input.id));
      if (availableSeatIds.length)
        await tx
          .insert(eventSeats)
          .values(availableSeatIds.map((seatId) => ({ eventId: input.id, seatId })));
      await tx
        .update(events)
        .set({ lockedSeatHalf: input.lockedSeatHalf, version: sql`${events.version} + 1` })
        .where(eq(events.id, input.id));
      await tx.insert(eventAuditLogs).values({
        eventId: input.id,
        action: "seat_availability_changed",
        details: {
          source: input.changeSource,
          side: input.side,
          lockedSeatHalfBefore: event.lockedSeatHalf,
          lockedSeatHalfAfter: input.lockedSeatHalf,
          ...describeAvailabilityChange(
            currentAvailable.map((item) => item.seatId),
            availableSeatIds,
          ),
        },
      });
    });
    revalidatePath(`/admin/events/${input.id}`);
    return adminActionSuccess("活动开放范围已保存。", "EVENT_SEATS_SAVED");
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "event_seat_availability_save_failed",
        eventId: input.id,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    );
    return adminActionError("活动开放范围保存失败，请稍后重试。", "EVENT_SEATS_SAVE_FAILED");
  }
}

const eventStatusInputSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["open", "ended"]),
});

export type EventStatusSaveState = AdminActionState;

export async function setEventStatusAction(
  _previousState: EventStatusSaveState,
  formData: FormData,
): Promise<EventStatusSaveState> {
  await requireAdmin();
  const parsed = eventStatusInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return {
      status: "error",
      message: "活动状态数据无效，请刷新页面后重试。",
      submission: Date.now(),
      code: "INVALID_EVENT_STATUS",
    };
  const { id, status } = parsed.data;
  let successNotice: "event-opened" | "event-reopened" | "event-ended" =
    status === "ended" ? "event-ended" : "event-opened";
  try {
    const failure = await getDb().transaction(async (tx): Promise<EventStatusSaveState | null> => {
      const [event] = await tx
        .select({
          status: events.status,
          lotteryEnabled: events.lotteryEnabled,
          lotteryPoolBonus: events.lotteryPoolBonus,
          participationMode: events.participationMode,
          expectedLotteryTickets: events.expectedLotteryTickets,
        })
        .from(events)
        .where(eq(events.id, id))
        .limit(1)
        .for("update");
      if (!event)
        return {
          status: "error",
          message: "活动不存在或已被删除。",
          submission: Date.now(),
          code: "EVENT_NOT_FOUND",
        };
      if (!canChangeEventStatus(event.status, status))
        return {
          status: "error",
          message: "活动状态已发生变化，请刷新页面后重试。",
          submission: Date.now(),
          code: "EVENT_STATUS_CONFLICT",
        };
      if (status === "ended") {
        const now = Date.now();
        const [activeWorkflow] = await tx
          .select({ id: consecutiveCheckinWorkflows.id })
          .from(consecutiveCheckinWorkflows)
          .innerJoin(
            consecutiveCheckinWorkflowEvents,
            eq(consecutiveCheckinWorkflowEvents.workflowId, consecutiveCheckinWorkflows.id),
          )
          .where(
            and(
              eq(consecutiveCheckinWorkflowEvents.eventId, id),
              eq(consecutiveCheckinWorkflows.status, "active"),
              gt(consecutiveCheckinWorkflows.hardExpiresAt, new Date(now)),
              gt(consecutiveCheckinWorkflows.heartbeatAt, new Date(now - 120_000)),
            ),
          )
          .limit(1);
        if (activeWorkflow)
          return {
            status: "error",
            message: "仍有参与者正在进行连签，请等待完成或在主场发行页撤销后重试。",
            submission: Date.now(),
            code: "CONSECUTIVE_WORKFLOW_ACTIVE",
          };
      }
      if (status === "open" && event.status === "ended") successNotice = "event-reopened";
      if (status === "open" && event.lotteryEnabled) {
        const eligiblePool =
          event.participationMode === "onsite"
            ? [{ total: event.expectedLotteryTickets ?? 0 }]
            : await tx
                .select({
                  total: sql<number>`coalesce(sum(${participantTickets.quantity}), 0)::int`,
                })
                .from(participantTickets)
                .innerJoin(ticketTypes, eq(participantTickets.ticketTypeId, ticketTypes.id))
                .where(and(eq(ticketTypes.eventId, id), eq(ticketTypes.lotteryEligible, true)));
        const inventory = await tx
          .select({ total: sql<number>`coalesce(sum(${lotteryPrizes.quantity}), 0)::int` })
          .from(lotteryPrizes)
          .where(eq(lotteryPrizes.eventId, id));
        const eligibleTicketCount = Number(eligiblePool[0]?.total ?? 0);
        const prizeCount = Number(inventory[0]?.total ?? 0);
        const totalPoolCount = lotteryPoolSize(eligibleTicketCount, event.lotteryPoolBonus);
        if (!hasSufficientLotteryPool(eligibleTicketCount, event.lotteryPoolBonus, prizeCount)) {
          return {
            status: "error",
            message: `当前总奖池人数为 ${totalPoolCount}（${event.participationMode === "onsite" ? "预计可抽奖票数" : "参与抽奖票数"} ${eligibleTicketCount} + 额外奖池人数 ${event.lotteryPoolBonus}），奖品总数为 ${prizeCount}。奖品总数必须小于等于总奖池人数，请调整数量。`,
            submission: Date.now(),
            code: "LOTTERY_POOL_TOO_SMALL",
          };
        }
      }
      await tx
        .update(events)
        .set({ status, version: sql`${events.version} + 1` })
        .where(eq(events.id, id));
      await tx.insert(eventAuditLogs).values({
        eventId: id,
        action: "event_status_changed",
        details: { from: event.status, to: status },
      });
      return null;
    });
    if (failure) return failure;
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "event_status_save_failed",
        eventId: id,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    );
    return {
      status: "error",
      message: "活动状态更新失败，请稍后重试。",
      submission: Date.now(),
      code: "UPDATE_FAILED",
    };
  }
  revalidatePath("/admin/events");
  revalidatePath(`/admin/events/${id}`);
  redirect(`/admin/events/${id}?notice=${successNotice}`);
}

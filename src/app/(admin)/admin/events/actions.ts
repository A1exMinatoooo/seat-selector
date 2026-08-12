"use server";

import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { eventConfigurationInputSchema, eventInputSchema } from "@/features/events/schemas";
import { getDb } from "@/server/db/client";
import {
  eventAuditLogs,
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

export async function createEventAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const input = eventInputSchema.parse({
    ...Object.fromEntries(formData),
    ticketTypes: parseJsonFormField(formData, "ticketTypes"),
    prizes: parseJsonFormField(formData, "prizes"),
    availableSeatIds: parseJsonFormField(formData, "availableSeatIds"),
  });
  const eventId = await getDb().transaction(async (tx) => {
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
  redirect(`/admin/events/${eventId}`);
}

export async function updateEventConfigurationAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const input = eventConfigurationInputSchema.parse({
    ...Object.fromEntries(formData),
    ticketTypes: parseJsonFormField(formData, "ticketTypes"),
    prizes: parseJsonFormField(formData, "prizes"),
  });

  await getDb().transaction(async (tx) => {
    const [event] = await tx
      .select({ status: events.status, participationMode: events.participationMode })
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
  revalidatePath("/admin/events");
  revalidatePath(`/admin/events/${input.id}`);
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
    changeSource: z
      .enum(["manual", "half_lock", "half_unlock", "half_switch", "quick_count", "rectangle_add"])
      .default("manual"),
    side: z.enum(["left", "right"]).optional(),
  })
  .superRefine((input, context) => {
    if (input.changeSource.startsWith("half_") && !input.side)
      context.addIssue({ code: "custom", path: ["side"], message: "半场方向缺失" });
  });

export type SeatAvailabilitySaveState = {
  status: "idle" | "success" | "error";
  message: string;
  submission: number;
};

export async function updateEventSeatsAction(
  _previousState: SeatAvailabilitySaveState,
  formData: FormData,
): Promise<SeatAvailabilitySaveState> {
  await requireAdmin();
  const parsed = eventAvailabilityInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return {
      status: "error",
      message: "座位开放范围数据无效，请刷新页面后重试。",
      submission: Date.now(),
    };
  const input = parsed.data;
  try {
    await getDb().transaction(async (tx) => {
      const [event] = await tx
        .select({ hallId: events.hallId, status: events.status })
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
        .set({ version: sql`${events.version} + 1` })
        .where(eq(events.id, input.id));
      await tx.insert(eventAuditLogs).values({
        eventId: input.id,
        action: "seat_availability_changed",
        details: {
          source: input.changeSource,
          side: input.side,
          ...describeAvailabilityChange(
            currentAvailable.map((item) => item.seatId),
            availableSeatIds,
          ),
        },
      });
    });
    revalidatePath(`/admin/events/${input.id}`);
    return { status: "success", message: "活动开放范围已保存。", submission: Date.now() };
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "event_seat_availability_save_failed",
        eventId: input.id,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    );
    return { status: "error", message: "保存失败，请稍后重试。", submission: Date.now() };
  }
}

const eventStatusInputSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["open", "ended"]),
});

export type EventStatusSaveState = {
  status: "idle" | "success" | "error";
  message: string;
  submission: number;
  code:
    | "INVALID_EVENT_STATUS"
    | "EVENT_NOT_FOUND"
    | "EVENT_STATUS_CONFLICT"
    | "LOTTERY_POOL_TOO_SMALL"
    | "UPDATE_FAILED"
    | null;
};

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
  return {
    status: "success",
    message: status === "open" ? "活动已开放。" : "活动已结束。",
    submission: Date.now(),
    code: null,
  };
}

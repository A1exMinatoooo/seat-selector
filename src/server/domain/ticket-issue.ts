import "server-only";

import { and, asc, eq, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import {
  consecutiveCheckinLinks,
  consecutiveCheckinWorkflowEvents,
  consecutiveCheckinWorkflows,
  eventAuditLogs,
  events,
  participants,
  participantTickets,
  reservations,
  ticketIssueEvents,
  ticketIssues,
  ticketTypes,
} from "@/server/db/schema";
import { tokenHash } from "@/server/security/crypto";
import {
  createTicketIssueToken,
  verifyTicketIssueToken,
} from "@/server/security/ticket-issue-token";
import { DomainError, errorCodes } from "@/shared/errors";
import {
  groupedTicketIssueAllocationSchema,
  hasOnsiteLotteryCapacity,
  ticketIssueAllocationSchema,
  ticketIssueTotal,
} from "./ticket-issue-rules";

export type TicketIssueStatus = "active" | "claimed" | "expired" | "cancelled";

function groupedIssueInput(eventId: string, rawAllocation: unknown) {
  if (
    Array.isArray(rawAllocation) &&
    (rawAllocation.length === 0 ||
      !rawAllocation[0] ||
      typeof rawAllocation[0] !== "object" ||
      !("eventId" in rawAllocation[0]))
  )
    return [{ eventId, allocation: ticketIssueAllocationSchema.parse(rawAllocation) }];
  return groupedTicketIssueAllocationSchema.parse(rawAllocation);
}

export async function createTicketIssue(eventId: string, rawAllocation: unknown, now = Date.now()) {
  const requestedGroups = groupedIssueInput(eventId, rawAllocation);
  return getDb().transaction(async (tx) => {
    const [source] = await tx
      .select({
        id: events.id,
        publicCode: events.publicCode,
        name: events.name,
        startsAt: events.startsAt,
        status: events.status,
        participationMode: events.participationMode,
        maxTicketsPerIssue: events.maxTicketsPerIssue,
      })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1)
      .for("update");
    if (!source || source.status !== "open" || source.participationMode !== "onsite")
      throw new DomainError(errorCodes.eventConflict, "活动未开放现场发行", 409);
    const sourceGroup = requestedGroups.find((group) => group.eventId === source.id);
    if (!sourceGroup || sourceGroup.allocation.length === 0)
      throw new DomainError(errorCodes.validation, "主场至少需要发行一张票", 400);

    const requestsTarget = requestedGroups.some((group) => group.eventId !== source.id);
    const linked = requestsTarget
      ? await tx
          .select({ targetEventId: consecutiveCheckinLinks.targetEventId })
          .from(consecutiveCheckinLinks)
          .where(eq(consecutiveCheckinLinks.sourceEventId, source.id))
      : [];
    const allowedIds = new Set([source.id, ...linked.map((row) => row.targetEventId)]);
    if (requestedGroups.some((group) => !allowedIds.has(group.eventId)))
      throw new DomainError(errorCodes.validation, "发行活动不属于当前连签配置", 400);
    const includedGroups = requestedGroups.filter((group) => group.allocation.length > 0);
    const eventRows =
      includedGroups.length === 1 && includedGroups[0]?.eventId === source.id
        ? [source]
        : await tx
            .select({
              id: events.id,
              name: events.name,
              startsAt: events.startsAt,
              status: events.status,
              participationMode: events.participationMode,
              maxTicketsPerIssue: events.maxTicketsPerIssue,
            })
            .from(events)
            .where(
              inArray(
                events.id,
                includedGroups.map((group) => group.eventId),
              ),
            )
            .orderBy(asc(events.startsAt))
            .for("update");
    if (eventRows.length !== includedGroups.length)
      throw new DomainError(errorCodes.validation, "部分发行活动不存在", 400);

    const snapshots = [];
    for (const event of eventRows) {
      if (event.status !== "open" || event.participationMode !== "onsite")
        throw new DomainError(errorCodes.eventConflict, `${event.name} 尚未开放现场发行`, 409);
      const allocation =
        includedGroups.find((group) => group.eventId === event.id)?.allocation ?? [];
      const ticketTotal = ticketIssueTotal(allocation);
      if (ticketTotal < 1 || ticketTotal > event.maxTicketsPerIssue)
        throw new DomainError(errorCodes.validation, `${event.name} 的发行张数超出上限`, 400);
      const validTypes = await tx
        .select({ id: ticketTypes.id, name: ticketTypes.name })
        .from(ticketTypes)
        .where(
          and(
            eq(ticketTypes.eventId, event.id),
            inArray(
              ticketTypes.id,
              allocation.map((item) => item.ticketTypeId),
            ),
          ),
        );
      if (validTypes.length !== allocation.length)
        throw new DomainError(errorCodes.validation, `${event.name} 的票种已失效`, 400);
      snapshots.push({
        eventId: event.id,
        eventName: event.name,
        startsAt: event.startsAt,
        ticketTotal,
        allocation: allocation.map((item) => ({
          ...item,
          name: validTypes.find((type) => type.id === item.ticketTypeId)?.name ?? "未知票种",
        })),
      });
    }
    const created = createTicketIssueToken(source.publicCode, now);
    const sourceSnapshot = snapshots.find((snapshot) => snapshot.eventId === source.id)!;
    await tx.insert(ticketIssues).values({
      id: created.issueId,
      eventId,
      tokenNonce: created.nonce,
      tokenHash: created.tokenHash,
      allocation: sourceSnapshot.allocation.map(({ ticketTypeId, quantity }) => ({
        ticketTypeId,
        quantity,
      })),
      issuedAt: created.issuedAt,
      expiresAt: created.expiresAt,
    });
    await tx.insert(ticketIssueEvents).values(
      snapshots.map((snapshot, sortOrder) => ({
        issueId: created.issueId,
        eventId: snapshot.eventId,
        sortOrder,
        allocation: snapshot.allocation.map(({ ticketTypeId, quantity }) => ({
          ticketTypeId,
          quantity,
        })),
      })),
    );
    await tx.insert(eventAuditLogs).values({
      eventId,
      action: "ticket_issue_created",
      details: {
        issueId: created.issueId,
        ticketTotal: snapshots.reduce((sum, snapshot) => sum + snapshot.ticketTotal, 0),
        events: snapshots.map((snapshot) => ({
          id: snapshot.eventId,
          name: snapshot.eventName,
          ticketTotal: snapshot.ticketTotal,
        })),
      },
    });
    return {
      ...created,
      publicCode: source.publicCode,
      eventName: source.name,
      allocation: sourceSnapshot.allocation,
      events: snapshots,
    };
  });
}

export async function ticketIssueStatus(
  eventId: string,
  issueId: string,
  now = Date.now(),
): Promise<TicketIssueStatus> {
  const [issue] = await getDb()
    .select({
      consumedAt: ticketIssues.consumedAt,
      invalidatedAt: ticketIssues.invalidatedAt,
      expiresAt: ticketIssues.expiresAt,
    })
    .from(ticketIssues)
    .where(and(eq(ticketIssues.id, issueId), eq(ticketIssues.eventId, eventId)))
    .limit(1);
  if (!issue) throw new DomainError(errorCodes.notFound, "发行记录不存在", 404);
  if (issue.consumedAt) return "claimed";
  if (issue.invalidatedAt) return "cancelled";
  if (issue.expiresAt.getTime() <= now) return "expired";
  return "active";
}

export async function cancelTicketIssue(
  eventId: string,
  issueId: string,
  now = Date.now(),
): Promise<Exclude<TicketIssueStatus, "active">> {
  return getDb().transaction(async (tx) => {
    const [event] = await tx
      .select({ id: events.id })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1)
      .for("update");
    if (!event) throw new DomainError(errorCodes.notFound, "活动不存在", 404);
    const [issue] = await tx
      .select({
        consumedAt: ticketIssues.consumedAt,
        invalidatedAt: ticketIssues.invalidatedAt,
        expiresAt: ticketIssues.expiresAt,
      })
      .from(ticketIssues)
      .where(and(eq(ticketIssues.id, issueId), eq(ticketIssues.eventId, eventId)))
      .limit(1)
      .for("update");
    if (!issue) throw new DomainError(errorCodes.notFound, "发行记录不存在", 404);
    if (issue.consumedAt) return "claimed";
    if (issue.invalidatedAt) return "cancelled";
    if (issue.expiresAt.getTime() <= now) return "expired";
    const [cancelled] = await tx
      .update(ticketIssues)
      .set({ invalidatedAt: new Date(now) })
      .where(
        and(
          eq(ticketIssues.id, issueId),
          eq(ticketIssues.eventId, eventId),
          isNull(ticketIssues.consumedAt),
          isNull(ticketIssues.invalidatedAt),
        ),
      )
      .returning({ id: ticketIssues.id });
    if (!cancelled) throw new DomainError(errorCodes.eventConflict, "二维码状态已变化", 409);
    return "cancelled";
  });
}

export async function claimTicketIssue(
  publicCode: string,
  token: string,
  deviceHash: string,
  now = Date.now(),
) {
  const payload = verifyTicketIssueToken(publicCode, token, now);
  if (!payload) throw new DomainError(errorCodes.ticketIssueExpired, "二维码已过期", 403);
  return getDb().transaction(async (tx) => {
    const [issueRef] = await tx
      .select({ eventId: ticketIssues.eventId })
      .from(ticketIssues)
      .where(eq(ticketIssues.id, payload.issueId))
      .limit(1);
    if (!issueRef) throw new DomainError(errorCodes.ticketIssueClaimed, "二维码已领取或失效", 409);
    const [event] = await tx
      .select({
        id: events.id,
        publicCode: events.publicCode,
        status: events.status,
        participationMode: events.participationMode,
        lotteryEnabled: events.lotteryEnabled,
        expectedLotteryTickets: events.expectedLotteryTickets,
        nextIssueNumber: events.nextIssueNumber,
      })
      .from(events)
      .where(eq(events.id, issueRef.eventId))
      .limit(1)
      .for("update");
    if (
      !event ||
      event.publicCode !== publicCode ||
      event.status !== "open" ||
      event.participationMode !== "onsite"
    )
      throw new DomainError(errorCodes.eventConflict, "活动未开放现场发行", 409);
    const [issue] = await tx
      .select()
      .from(ticketIssues)
      .where(eq(ticketIssues.id, payload.issueId))
      .limit(1)
      .for("update");
    if (
      !issue ||
      issue.tokenNonce !== payload.nonce ||
      issue.tokenHash !== tokenHash(token) ||
      issue.consumedAt ||
      issue.invalidatedAt ||
      issue.expiresAt.getTime() <= now
    )
      throw new DomainError(errorCodes.ticketIssueClaimed, "二维码已领取或失效", 409);
    const issueEventRows = await tx
      .select({
        eventId: ticketIssueEvents.eventId,
        sortOrder: ticketIssueEvents.sortOrder,
        allocation: ticketIssueEvents.allocation,
      })
      .from(ticketIssueEvents)
      .where(eq(ticketIssueEvents.issueId, issue.id))
      .orderBy(asc(ticketIssueEvents.sortOrder));
    if (issueEventRows.length > 1) {
      const heartbeatCutoff = new Date(now - 120_000);
      await tx
        .update(consecutiveCheckinWorkflows)
        .set({ status: "expired" })
        .where(
          and(
            eq(consecutiveCheckinWorkflows.deviceHash, deviceHash),
            eq(consecutiveCheckinWorkflows.status, "active"),
            or(
              lt(consecutiveCheckinWorkflows.hardExpiresAt, new Date(now)),
              lt(consecutiveCheckinWorkflows.heartbeatAt, heartbeatCutoff),
            ),
          ),
        );
      const [active] = await tx
        .select({ id: consecutiveCheckinWorkflows.id })
        .from(consecutiveCheckinWorkflows)
        .where(
          and(
            eq(consecutiveCheckinWorkflows.deviceHash, deviceHash),
            eq(consecutiveCheckinWorkflows.status, "active"),
          ),
        )
        .limit(1)
        .for("update");
      if (active)
        throw new DomainError(errorCodes.consecutiveWorkflowActive, "设备已有进行中的连签", 409);

      const eventRows = await tx
        .select({
          id: events.id,
          name: events.name,
          status: events.status,
          participationMode: events.participationMode,
          lotteryEnabled: events.lotteryEnabled,
          expectedLotteryTickets: events.expectedLotteryTickets,
          nextIssueNumber: events.nextIssueNumber,
        })
        .from(events)
        .where(
          inArray(
            events.id,
            issueEventRows.map((row) => row.eventId),
          ),
        )
        .orderBy(asc(events.id))
        .for("update");
      if (
        eventRows.length !== issueEventRows.length ||
        eventRows.some((row) => row.status !== "open" || row.participationMode !== "onsite")
      )
        throw new DomainError(
          errorCodes.consecutiveWorkflowUnavailable,
          "部分连签活动已不可用",
          409,
        );

      const workflowEvents: Array<{
        eventId: string;
        participantId: string;
        sortOrder: number;
        allocation: typeof issue.allocation;
        historical: boolean;
      }> = [];
      for (const snapshot of issueEventRows) {
        const currentEvent = eventRows.find((row) => row.id === snapshot.eventId)!;
        const types = await tx
          .select({ id: ticketTypes.id, lotteryEligible: ticketTypes.lotteryEligible })
          .from(ticketTypes)
          .where(eq(ticketTypes.eventId, currentEvent.id));
        const typeById = new Map(types.map((type) => [type.id, type]));
        if (snapshot.allocation.some((item) => !typeById.has(item.ticketTypeId)))
          throw new DomainError(
            errorCodes.validation,
            `${currentEvent.name} 的发行票种已失效`,
            400,
          );
        const [existing] = await tx
          .select({ id: participants.id })
          .from(participants)
          .where(
            and(
              eq(participants.eventId, currentEvent.id),
              eq(participants.deviceHash, deviceHash),
              eq(participants.source, "onsite"),
            ),
          )
          .limit(1)
          .for("update");
        const [existingReservation] = existing
          ? await tx
              .select({ id: reservations.id })
              .from(reservations)
              .where(
                and(
                  eq(reservations.eventId, currentEvent.id),
                  eq(reservations.participantId, existing.id),
                ),
              )
              .limit(1)
          : [];
        if (existing && existingReservation) {
          workflowEvents.push({
            eventId: currentEvent.id,
            participantId: existing.id,
            sortOrder: snapshot.sortOrder,
            allocation: snapshot.allocation,
            historical: true,
          });
          continue;
        }

        const newEligible = snapshot.allocation.reduce(
          (sum, item) =>
            sum + (typeById.get(item.ticketTypeId)?.lotteryEligible ? item.quantity : 0),
          0,
        );
        if (currentEvent.lotteryEnabled) {
          const [used] = await tx
            .select({
              total: sql<number>`coalesce(sum(${participantTickets.quantity}), 0)::int`,
            })
            .from(participantTickets)
            .innerJoin(participants, eq(participants.id, participantTickets.participantId))
            .innerJoin(ticketTypes, eq(ticketTypes.id, participantTickets.ticketTypeId))
            .where(
              and(
                eq(participants.eventId, currentEvent.id),
                eq(participants.source, "onsite"),
                eq(ticketTypes.lotteryEligible, true),
                existing ? ne(participants.id, existing.id) : sql`true`,
              ),
            );
          if (
            !hasOnsiteLotteryCapacity(
              Number(used?.total ?? 0),
              newEligible,
              currentEvent.expectedLotteryTickets ?? 0,
            )
          )
            throw new DomainError(
              errorCodes.ticketIssueCapacity,
              `${currentEvent.name} 的预计可抽奖票数额度不足`,
              409,
            );
        }
        const ticketTotal = ticketIssueTotal(snapshot.allocation);
        let participantId: string;
        if (existing) {
          participantId = existing.id;
          await tx
            .delete(participantTickets)
            .where(eq(participantTickets.participantId, existing.id));
          await tx
            .update(participants)
            .set({ ticketTotal, deviceBoundAt: new Date(now) })
            .where(eq(participants.id, existing.id));
        } else {
          const issueNumber = currentEvent.nextIssueNumber;
          const [created] = await tx
            .insert(participants)
            .values({
              eventId: currentEvent.id,
              nickname: `现场领取 #${String(issueNumber).padStart(4, "0")}`,
              nicknameFirst: "现",
              phoneDigits: "",
              phoneLast4: "",
              phoneIsFull: false,
              ticketTotal,
              source: "onsite",
              issueNumber,
              deviceHash,
              deviceBoundAt: new Date(now),
            })
            .returning({ id: participants.id });
          if (!created) throw new Error("Consecutive onsite participant creation failed");
          participantId = created.id;
          await tx
            .update(events)
            .set({ nextIssueNumber: sql`${events.nextIssueNumber} + 1` })
            .where(eq(events.id, currentEvent.id));
        }
        await tx.insert(participantTickets).values(
          snapshot.allocation.map((item) => ({
            participantId,
            ticketTypeId: item.ticketTypeId,
            quantity: item.quantity,
          })),
        );
        workflowEvents.push({
          eventId: currentEvent.id,
          participantId,
          sortOrder: snapshot.sortOrder,
          allocation: snapshot.allocation,
          historical: false,
        });
      }

      const claimedAt = new Date(now);
      const hardExpiresAt = new Date(now + 300_000);
      const [workflow] = await tx
        .insert(consecutiveCheckinWorkflows)
        .values({
          issueId: issue.id,
          sourceEventId: event.id,
          deviceHash,
          claimedAt,
          heartbeatAt: claimedAt,
          hardExpiresAt,
        })
        .returning({ id: consecutiveCheckinWorkflows.id });
      if (!workflow) throw new Error("Consecutive workflow creation failed");
      await tx
        .insert(consecutiveCheckinWorkflowEvents)
        .values(workflowEvents.map((item) => ({ ...item, workflowId: workflow.id })));
      await tx
        .update(ticketIssues)
        .set({ consumedAt: claimedAt, participantId: workflowEvents[0]?.participantId })
        .where(and(eq(ticketIssues.id, issue.id), isNull(ticketIssues.consumedAt)));
      await tx.insert(eventAuditLogs).values(
        workflowEvents.map((item) => ({
          eventId: item.eventId,
          participantId: item.participantId,
          action: "consecutive_checkin_workflow_claimed" as const,
          details: { workflowId: workflow.id, issueId: issue.id, historical: item.historical },
        })),
      );
      return {
        eventId: event.id,
        participantId: workflowEvents[0]!.participantId,
        code: publicCode,
        workflowId: workflow.id,
        hardExpiresAt,
      };
    }
    const types = await tx
      .select({ id: ticketTypes.id, lotteryEligible: ticketTypes.lotteryEligible })
      .from(ticketTypes)
      .where(eq(ticketTypes.eventId, event.id));
    const typeById = new Map(types.map((type) => [type.id, type]));
    if (issue.allocation.some((item) => !typeById.has(item.ticketTypeId)))
      throw new DomainError(errorCodes.validation, "发行票种已失效", 400);
    const newEligible = issue.allocation.reduce(
      (sum, item) => sum + (typeById.get(item.ticketTypeId)?.lotteryEligible ? item.quantity : 0),
      0,
    );
    const [existing] = await tx
      .select({ id: participants.id, issueNumber: participants.issueNumber })
      .from(participants)
      .where(
        and(
          eq(participants.eventId, event.id),
          eq(participants.deviceHash, deviceHash),
          eq(participants.source, "onsite"),
        ),
      )
      .limit(1)
      .for("update");
    if (existing) {
      const [reservation] = await tx
        .select({ id: reservations.id })
        .from(reservations)
        .where(and(eq(reservations.eventId, event.id), eq(reservations.participantId, existing.id)))
        .limit(1);
      if (reservation)
        throw new DomainError(errorCodes.ticketIssueSelectionExists, "设备已完成选座", 409);
    }
    const oldEligibleRows = existing
      ? await tx
          .select({
            quantity: participantTickets.quantity,
            lotteryEligible: ticketTypes.lotteryEligible,
          })
          .from(participantTickets)
          .innerJoin(ticketTypes, eq(participantTickets.ticketTypeId, ticketTypes.id))
          .where(eq(participantTickets.participantId, existing.id))
      : [];
    const oldEligible = oldEligibleRows.reduce(
      (sum, row) => sum + (row.lotteryEligible ? row.quantity : 0),
      0,
    );
    if (event.lotteryEnabled) {
      const [used] = await tx
        .select({ total: sql<number>`coalesce(sum(${participantTickets.quantity}), 0)::int` })
        .from(participantTickets)
        .innerJoin(participants, eq(participants.id, participantTickets.participantId))
        .innerJoin(ticketTypes, eq(ticketTypes.id, participantTickets.ticketTypeId))
        .where(
          and(
            eq(participants.eventId, event.id),
            eq(participants.source, "onsite"),
            eq(ticketTypes.lotteryEligible, true),
            existing ? ne(participants.id, existing.id) : sql`true`,
          ),
        );
      if (
        !hasOnsiteLotteryCapacity(
          Number(used?.total ?? 0),
          newEligible,
          event.expectedLotteryTickets ?? 0,
        )
      )
        throw new DomainError(errorCodes.ticketIssueCapacity, "预计可抽奖票数额度不足", 409);
    }
    const ticketTotal = ticketIssueTotal(issue.allocation);
    let participantId: string;
    let replaced = false;
    if (existing) {
      participantId = existing.id;
      replaced = true;
      await tx
        .delete(participantTickets)
        .where(eq(participantTickets.participantId, participantId));
      await tx
        .update(participants)
        .set({ ticketTotal, deviceBoundAt: new Date(now) })
        .where(eq(participants.id, participantId));
    } else {
      const issueNumber = event.nextIssueNumber;
      const [created] = await tx
        .insert(participants)
        .values({
          eventId: event.id,
          nickname: `现场领取 #${String(issueNumber).padStart(4, "0")}`,
          nicknameFirst: "现",
          phoneDigits: "",
          phoneLast4: "",
          phoneIsFull: false,
          ticketTotal,
          source: "onsite",
          issueNumber,
          deviceHash,
          deviceBoundAt: new Date(now),
        })
        .returning({ id: participants.id });
      if (!created) throw new Error("Onsite participant creation failed");
      participantId = created.id;
      await tx
        .update(events)
        .set({ nextIssueNumber: sql`${events.nextIssueNumber} + 1` })
        .where(eq(events.id, event.id));
    }
    await tx.insert(participantTickets).values(
      issue.allocation.map((item) => ({
        participantId,
        ticketTypeId: item.ticketTypeId,
        quantity: item.quantity,
      })),
    );
    await tx
      .update(ticketIssues)
      .set({ consumedAt: new Date(now), participantId })
      .where(and(eq(ticketIssues.id, issue.id), isNull(ticketIssues.consumedAt)));
    await tx.insert(eventAuditLogs).values({
      eventId: event.id,
      participantId,
      action: replaced ? "ticket_issue_replaced" : "ticket_issue_claimed",
      details: {
        issueId: issue.id,
        ticketTotal,
        eligibleTickets: newEligible,
        replacedEligibleTickets: oldEligible,
      },
    });
    return { eventId: event.id, participantId, code: publicCode };
  });
}

import "server-only";

import { and, asc, eq, gt, inArray, lt, ne, or } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import {
  consecutiveCheckinSeatHolds,
  consecutiveCheckinWorkflowEvents,
  consecutiveCheckinWorkflows,
  eventAuditLogs,
  eventSeats,
  events,
  halls,
  participants,
  reservationSeats,
  seats,
} from "@/server/db/schema";
import { effectiveEventAvailability } from "./event-seat-availability";
import { DomainError, errorCodes } from "@/shared/errors";
import { postgresErrorInfo } from "@/shared/postgres-error";

export const consecutiveHeartbeatIntervalMs = 5_000;
export const consecutiveLeaseMs = 120_000;
export const consecutiveHardLimitMs = 300_000;

function activeAt(now: number) {
  return and(
    eq(consecutiveCheckinWorkflows.status, "active"),
    gt(consecutiveCheckinWorkflows.hardExpiresAt, new Date(now)),
    gt(consecutiveCheckinWorkflows.heartbeatAt, new Date(now - consecutiveLeaseMs)),
  );
}

async function expireInactiveWorkflows(now: number): Promise<void> {
  const db = getDb();
  const expired = await db
    .update(consecutiveCheckinWorkflows)
    .set({ status: "expired" })
    .where(
      and(
        eq(consecutiveCheckinWorkflows.status, "active"),
        or(
          lt(consecutiveCheckinWorkflows.hardExpiresAt, new Date(now)),
          lt(consecutiveCheckinWorkflows.heartbeatAt, new Date(now - consecutiveLeaseMs)),
        ),
      ),
    )
    .returning({ id: consecutiveCheckinWorkflows.id });
  if (expired.length)
    await db.delete(consecutiveCheckinSeatHolds).where(
      inArray(
        consecutiveCheckinSeatHolds.workflowId,
        expired.map((row) => row.id),
      ),
    );
  await db
    .delete(consecutiveCheckinSeatHolds)
    .where(lt(consecutiveCheckinSeatHolds.expiresAt, new Date(now)));
}

async function workflowIdentity(workflowId: string, deviceHash: string, code: string, now: number) {
  await expireInactiveWorkflows(now);
  const [workflow] = await getDb()
    .select({
      id: consecutiveCheckinWorkflows.id,
      sourceEventId: consecutiveCheckinWorkflows.sourceEventId,
      status: consecutiveCheckinWorkflows.status,
      claimedAt: consecutiveCheckinWorkflows.claimedAt,
      heartbeatAt: consecutiveCheckinWorkflows.heartbeatAt,
      hardExpiresAt: consecutiveCheckinWorkflows.hardExpiresAt,
      publicCode: events.publicCode,
    })
    .from(consecutiveCheckinWorkflows)
    .innerJoin(events, eq(events.id, consecutiveCheckinWorkflows.sourceEventId))
    .where(
      and(
        eq(consecutiveCheckinWorkflows.id, workflowId),
        eq(consecutiveCheckinWorkflows.deviceHash, deviceHash),
      ),
    )
    .limit(1);
  if (!workflow || workflow.publicCode !== code)
    throw new DomainError(errorCodes.unauthorized, "连签会话无效", 401);
  if (workflow.status !== "active")
    throw new DomainError(errorCodes.consecutiveWorkflowExpired, "连签已结束或过期", 409);
  return workflow;
}

export async function heartbeatConsecutiveWorkflow(
  workflowId: string,
  deviceHash: string,
  code: string,
  now = Date.now(),
) {
  const workflow = await workflowIdentity(workflowId, deviceHash, code, now);
  const leaseExpiresAt = new Date(
    Math.min(now + consecutiveLeaseMs, workflow.hardExpiresAt.getTime()),
  );
  await getDb().transaction(async (tx) => {
    await tx
      .update(consecutiveCheckinWorkflows)
      .set({ heartbeatAt: new Date(now) })
      .where(
        and(
          eq(consecutiveCheckinWorkflows.id, workflow.id),
          eq(consecutiveCheckinWorkflows.status, "active"),
        ),
      );
    await tx
      .update(consecutiveCheckinSeatHolds)
      .set({ expiresAt: leaseExpiresAt })
      .where(eq(consecutiveCheckinSeatHolds.workflowId, workflow.id));
  });
  return { hardExpiresAt: workflow.hardExpiresAt, leaseExpiresAt };
}

export async function replaceConsecutiveSeatHolds(
  workflowId: string,
  eventId: string,
  seatIds: string[],
  deviceHash: string,
  code: string,
  now = Date.now(),
) {
  const workflow = await workflowIdentity(workflowId, deviceHash, code, now);
  try {
    return await getDb().transaction(async (tx) => {
      const [step] = await tx
        .select({
          participantId: consecutiveCheckinWorkflowEvents.participantId,
          historical: consecutiveCheckinWorkflowEvents.historical,
          ticketTotal: participants.ticketTotal,
          status: events.status,
          hallId: events.hallId,
          lockedSeatHalf: events.lockedSeatHalf,
          centerAfterColumn: halls.centerAfterColumn,
        })
        .from(consecutiveCheckinWorkflowEvents)
        .innerJoin(
          participants,
          eq(participants.id, consecutiveCheckinWorkflowEvents.participantId),
        )
        .innerJoin(events, eq(events.id, consecutiveCheckinWorkflowEvents.eventId))
        .innerJoin(halls, eq(halls.id, events.hallId))
        .where(
          and(
            eq(consecutiveCheckinWorkflowEvents.workflowId, workflow.id),
            eq(consecutiveCheckinWorkflowEvents.eventId, eventId),
          ),
        )
        .limit(1);
      if (!step || step.historical || step.status !== "open")
        throw new DomainError(errorCodes.consecutiveWorkflowUnavailable, "当前场次不可锁座", 409);
      if (seatIds.length !== step.ticketTotal || new Set(seatIds).size !== step.ticketTotal)
        throw new DomainError(errorCodes.validation, "锁座数量与票数不一致", 400);

      await tx
        .delete(consecutiveCheckinSeatHolds)
        .where(lt(consecutiveCheckinSeatHolds.expiresAt, new Date(now)));
      const [validSeats, hallSeats, occupied] = await Promise.all([
        tx
          .select({ id: seats.id })
          .from(seats)
          .innerJoin(
            eventSeats,
            and(eq(eventSeats.seatId, seats.id), eq(eventSeats.eventId, eventId)),
          )
          .where(
            and(
              eq(seats.hallId, step.hallId),
              eq(seats.kind, "seat"),
              eq(seats.selectable, true),
              inArray(seats.id, seatIds),
            ),
          ),
        tx
          .select({
            id: seats.id,
            columnIndex: seats.columnIndex,
            kind: seats.kind,
            templateSelectable: seats.selectable,
          })
          .from(seats)
          .where(eq(seats.hallId, step.hallId)),
        tx
          .select({ seatId: reservationSeats.seatId })
          .from(reservationSeats)
          .where(
            and(eq(reservationSeats.eventId, eventId), inArray(reservationSeats.seatId, seatIds)),
          ),
      ]);
      const effective = effectiveEventAvailability(
        hallSeats,
        validSeats.map((seat) => seat.id),
        step.lockedSeatHalf,
        step.centerAfterColumn,
      );
      if (effective.length !== seatIds.length || occupied.length)
        throw new DomainError(errorCodes.consecutiveSeatHeld, "部分座位已不可用", 409);

      const oldHolds = await tx
        .select({ seatId: consecutiveCheckinSeatHolds.seatId })
        .from(consecutiveCheckinSeatHolds)
        .where(
          and(
            eq(consecutiveCheckinSeatHolds.workflowId, workflow.id),
            eq(consecutiveCheckinSeatHolds.eventId, eventId),
          ),
        );
      const oldIds = new Set(oldHolds.map((hold) => hold.seatId));
      const additions = seatIds.filter((seatId) => !oldIds.has(seatId));
      const leaseExpiresAt = new Date(
        Math.min(now + consecutiveLeaseMs, workflow.hardExpiresAt.getTime()),
      );
      if (additions.length)
        await tx.insert(consecutiveCheckinSeatHolds).values(
          additions.map((seatId) => ({
            workflowId: workflow.id,
            eventId,
            participantId: step.participantId,
            seatId,
            expiresAt: leaseExpiresAt,
          })),
        );
      const removals = oldHolds
        .map((hold) => hold.seatId)
        .filter((seatId) => !seatIds.includes(seatId));
      if (removals.length)
        await tx
          .delete(consecutiveCheckinSeatHolds)
          .where(
            and(
              eq(consecutiveCheckinSeatHolds.workflowId, workflow.id),
              eq(consecutiveCheckinSeatHolds.eventId, eventId),
              inArray(consecutiveCheckinSeatHolds.seatId, removals),
            ),
          );
      await tx
        .update(consecutiveCheckinSeatHolds)
        .set({ expiresAt: leaseExpiresAt })
        .where(
          and(
            eq(consecutiveCheckinSeatHolds.workflowId, workflow.id),
            eq(consecutiveCheckinSeatHolds.eventId, eventId),
          ),
        );
      await tx.insert(eventAuditLogs).values({
        eventId,
        participantId: step.participantId,
        action: "consecutive_checkin_seats_held",
        details: { workflowId: workflow.id, seatCount: seatIds.length },
      });
      return { seatIds, leaseExpiresAt, hardExpiresAt: workflow.hardExpiresAt };
    });
  } catch (error) {
    if (postgresErrorInfo(error).code === "23505")
      throw new DomainError(errorCodes.consecutiveSeatHeld, "部分座位正在被他人选择", 409);
    throw error;
  }
}

export async function consecutiveWorkflowSeatState(
  workflowId: string,
  eventId: string,
  deviceHash: string,
  code: string,
  now = Date.now(),
) {
  const workflow = await workflowIdentity(workflowId, deviceHash, code, now);
  const [reserved, held, mine] = await Promise.all([
    getDb()
      .select({ seatId: reservationSeats.seatId })
      .from(reservationSeats)
      .where(eq(reservationSeats.eventId, eventId)),
    getDb()
      .select({ seatId: consecutiveCheckinSeatHolds.seatId })
      .from(consecutiveCheckinSeatHolds)
      .where(
        and(
          eq(consecutiveCheckinSeatHolds.eventId, eventId),
          ne(consecutiveCheckinSeatHolds.workflowId, workflow.id),
          gt(consecutiveCheckinSeatHolds.expiresAt, new Date(now)),
        ),
      ),
    getDb()
      .select({ seatId: consecutiveCheckinSeatHolds.seatId })
      .from(consecutiveCheckinSeatHolds)
      .where(
        and(
          eq(consecutiveCheckinSeatHolds.eventId, eventId),
          eq(consecutiveCheckinSeatHolds.workflowId, workflow.id),
          gt(consecutiveCheckinSeatHolds.expiresAt, new Date(now)),
        ),
      ),
  ]);
  return {
    occupiedSeatIds: [...reserved, ...held].map((row) => row.seatId),
    selectedSeatIds: mine.map((row) => row.seatId),
    hardExpiresAt: workflow.hardExpiresAt,
  };
}

export async function listActiveConsecutiveWorkflows(sourceEventId: string, now = Date.now()) {
  await expireInactiveWorkflows(now);
  const rows = await getDb()
    .select({
      id: consecutiveCheckinWorkflows.id,
      claimedAt: consecutiveCheckinWorkflows.claimedAt,
      hardExpiresAt: consecutiveCheckinWorkflows.hardExpiresAt,
      eventName: events.name,
      sortOrder: consecutiveCheckinWorkflowEvents.sortOrder,
    })
    .from(consecutiveCheckinWorkflows)
    .innerJoin(
      consecutiveCheckinWorkflowEvents,
      eq(consecutiveCheckinWorkflowEvents.workflowId, consecutiveCheckinWorkflows.id),
    )
    .innerJoin(events, eq(events.id, consecutiveCheckinWorkflowEvents.eventId))
    .where(and(eq(consecutiveCheckinWorkflows.sourceEventId, sourceEventId), activeAt(now)))
    .orderBy(
      asc(consecutiveCheckinWorkflows.claimedAt),
      asc(consecutiveCheckinWorkflowEvents.sortOrder),
    );
  const grouped = new Map<
    string,
    { id: string; claimedAt: Date; hardExpiresAt: Date; events: string[] }
  >();
  for (const row of rows) {
    const item = grouped.get(row.id) ?? {
      id: row.id,
      claimedAt: row.claimedAt,
      hardExpiresAt: row.hardExpiresAt,
      events: [],
    };
    item.events.push(row.eventName);
    grouped.set(row.id, item);
  }
  return [...grouped.values()];
}

export async function cancelConsecutiveWorkflow(
  sourceEventId: string,
  workflowId: string,
  now = Date.now(),
) {
  return getDb().transaction(async (tx) => {
    const [workflow] = await tx
      .select({ status: consecutiveCheckinWorkflows.status })
      .from(consecutiveCheckinWorkflows)
      .where(
        and(
          eq(consecutiveCheckinWorkflows.id, workflowId),
          eq(consecutiveCheckinWorkflows.sourceEventId, sourceEventId),
        ),
      )
      .limit(1)
      .for("update");
    if (!workflow) throw new DomainError(errorCodes.notFound, "连签流程不存在", 404);
    if (workflow.status !== "active") return workflow.status;
    const steps = await tx
      .select({
        eventId: consecutiveCheckinWorkflowEvents.eventId,
        participantId: consecutiveCheckinWorkflowEvents.participantId,
      })
      .from(consecutiveCheckinWorkflowEvents)
      .where(eq(consecutiveCheckinWorkflowEvents.workflowId, workflowId));
    await tx
      .update(consecutiveCheckinWorkflows)
      .set({ status: "cancelled", cancelledAt: new Date(now) })
      .where(eq(consecutiveCheckinWorkflows.id, workflowId));
    await tx
      .delete(consecutiveCheckinSeatHolds)
      .where(eq(consecutiveCheckinSeatHolds.workflowId, workflowId));
    await tx.insert(eventAuditLogs).values(
      steps.map((step) => ({
        eventId: step.eventId,
        participantId: step.participantId,
        action: "consecutive_checkin_workflow_cancelled" as const,
        details: { workflowId, source: "admin" },
      })),
    );
    return "cancelled" as const;
  });
}

export async function hasActiveConsecutiveWorkflowForEvent(eventId: string, now = Date.now()) {
  await expireInactiveWorkflows(now);
  const [active] = await getDb()
    .select({
      id: consecutiveCheckinWorkflows.id,
      sourceEventId: consecutiveCheckinWorkflows.sourceEventId,
    })
    .from(consecutiveCheckinWorkflows)
    .innerJoin(
      consecutiveCheckinWorkflowEvents,
      eq(consecutiveCheckinWorkflowEvents.workflowId, consecutiveCheckinWorkflows.id),
    )
    .where(and(eq(consecutiveCheckinWorkflowEvents.eventId, eventId), activeAt(now)))
    .limit(1);
  return active ?? null;
}

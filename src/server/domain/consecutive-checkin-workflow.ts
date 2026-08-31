import "server-only";

import { randomInt } from "node:crypto";
import { and, asc, count, eq, gt, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import {
  consecutiveCheckinSeatHolds,
  consecutiveCheckinWorkflowEvents,
  consecutiveCheckinWorkflows,
  eventAuditLogs,
  eventSeats,
  events,
  halls,
  lotteryDraws,
  lotteryPrizes,
  participantTickets,
  participants,
  reservations,
  reservationSeats,
  seats,
  ticketTypes,
} from "@/server/db/schema";
import { effectiveEventAvailability } from "./event-seat-availability";
import { prizeIndexForRoll } from "./lottery-rules";
import { DomainError, errorCodes } from "@/shared/errors";
import { postgresErrorInfo } from "@/shared/postgres-error";
import { formatSeatLabel } from "@/shared/seat-label";

export const consecutiveHeartbeatIntervalMs = 5_000;
export const consecutiveLeaseMs = 120_000;
export const consecutiveHardLimitMs = 300_000;

export type ConsecutiveWorkflowStepView = {
  eventId: string;
  eventName: string;
  lotteryEnabled: boolean;
  centerAfterColumn: number | null;
  ticketTotal: number;
  historical: boolean;
  sortOrder: number;
  tickets: Array<{ name: string; quantity: number; lotteryEligible: boolean }>;
  confirmedAt: string | null;
  confirmedSeats: string[];
  lotteryResults: Array<{ drawIndex: number; prizeName: string | null }>;
  lotteryChances: number;
  seats: Array<{
    id: string;
    rowIndex: number;
    columnIndex: number;
    rowLabel: string;
    columnLabel: string;
    kind: "seat" | "aisle" | "empty";
    selectable: boolean;
    golden: boolean;
  }>;
  availableSeatIds: string[];
  occupiedSeatIds: string[];
  selectedSeatIds: string[];
};

export type ConsecutiveWorkflowView = {
  id: string;
  status: "active" | "completed" | "cancelled" | "expired";
  claimedAt: string;
  hardExpiresAt: string;
  needsLocation: boolean;
  steps: ConsecutiveWorkflowStepView[];
};

export async function consecutiveWorkflowNeedsLocation(workflowId: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: events.id })
    .from(consecutiveCheckinWorkflowEvents)
    .innerJoin(events, eq(events.id, consecutiveCheckinWorkflowEvents.eventId))
    .innerJoin(participants, eq(participants.id, consecutiveCheckinWorkflowEvents.participantId))
    .where(
      and(
        eq(consecutiveCheckinWorkflowEvents.workflowId, workflowId),
        eq(consecutiveCheckinWorkflowEvents.historical, false),
        eq(events.locationCheckEnabled, true),
        // A null exemption means this participant must pass the shared workflow location check.
        // Drizzle expresses this nullable comparison through SQL equality semantics below.
        isNull(participants.locationExemptAt),
      ),
    )
    .limit(1);
  return Boolean(row);
}

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

async function workflowAuthorization(workflowId: string, deviceHash: string, code: string) {
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
  return workflow;
}

async function workflowIdentity(workflowId: string, deviceHash: string, code: string, now: number) {
  await expireInactiveWorkflows(now);
  const workflow = await workflowAuthorization(workflowId, deviceHash, code);
  if (workflow.status !== "active")
    throw new DomainError(errorCodes.consecutiveWorkflowExpired, "连签已结束或过期", 409);
  return workflow;
}

export async function getConsecutiveWorkflowView(
  workflowId: string,
  deviceHash: string,
  code: string,
  now = Date.now(),
): Promise<ConsecutiveWorkflowView> {
  await expireInactiveWorkflows(now);
  const workflow = await workflowAuthorization(workflowId, deviceHash, code);
  const stepRows = await getDb()
    .select({
      eventId: events.id,
      eventName: events.name,
      hallId: events.hallId,
      status: events.status,
      lotteryEnabled: events.lotteryEnabled,
      locationCheckEnabled: events.locationCheckEnabled,
      lockedSeatHalf: events.lockedSeatHalf,
      centerAfterColumn: halls.centerAfterColumn,
      participantId: consecutiveCheckinWorkflowEvents.participantId,
      ticketTotal: participants.ticketTotal,
      historical: consecutiveCheckinWorkflowEvents.historical,
      sortOrder: consecutiveCheckinWorkflowEvents.sortOrder,
    })
    .from(consecutiveCheckinWorkflowEvents)
    .innerJoin(events, eq(events.id, consecutiveCheckinWorkflowEvents.eventId))
    .innerJoin(halls, eq(halls.id, events.hallId))
    .innerJoin(participants, eq(participants.id, consecutiveCheckinWorkflowEvents.participantId))
    .where(eq(consecutiveCheckinWorkflowEvents.workflowId, workflow.id))
    .orderBy(asc(consecutiveCheckinWorkflowEvents.sortOrder));

  const steps: ConsecutiveWorkflowStepView[] = [];
  for (const step of stepRows) {
    const [ticketRows, reservationRows, lotteryResults] = await Promise.all([
      getDb()
        .select({
          name: ticketTypes.name,
          quantity: participantTickets.quantity,
          lotteryEligible: ticketTypes.lotteryEligible,
        })
        .from(participantTickets)
        .innerJoin(ticketTypes, eq(ticketTypes.id, participantTickets.ticketTypeId))
        .where(eq(participantTickets.participantId, step.participantId))
        .orderBy(asc(ticketTypes.sortOrder)),
      getDb()
        .select({
          confirmedAt: reservations.confirmedAt,
          rowLabel: seats.rowLabel,
          columnLabel: seats.columnLabel,
        })
        .from(reservations)
        .innerJoin(reservationSeats, eq(reservationSeats.reservationId, reservations.id))
        .innerJoin(seats, eq(seats.id, reservationSeats.seatId))
        .where(
          and(
            eq(reservations.eventId, step.eventId),
            eq(reservations.participantId, step.participantId),
          ),
        )
        .orderBy(asc(seats.rowIndex), asc(seats.columnIndex)),
      getDb()
        .select({ drawIndex: lotteryDraws.drawIndex, prizeName: lotteryDraws.prizeName })
        .from(lotteryDraws)
        .where(
          and(
            eq(lotteryDraws.eventId, step.eventId),
            eq(lotteryDraws.participantId, step.participantId),
          ),
        )
        .orderBy(asc(lotteryDraws.drawIndex)),
    ]);
    if (step.historical || workflow.status === "completed") {
      steps.push({
        eventId: step.eventId,
        eventName: step.eventName,
        lotteryEnabled: step.lotteryEnabled,
        centerAfterColumn: step.centerAfterColumn,
        ticketTotal: step.ticketTotal,
        historical: step.historical,
        sortOrder: step.sortOrder,
        tickets: ticketRows,
        confirmedAt: reservationRows[0]?.confirmedAt?.toISOString() ?? null,
        confirmedSeats: reservationRows.map((seat) =>
          formatSeatLabel(seat.rowLabel, seat.columnLabel),
        ),
        lotteryResults,
        lotteryChances: ticketRows.reduce(
          (sum, ticket) => sum + (ticket.lotteryEligible ? ticket.quantity : 0),
          0,
        ),
        seats: [],
        availableSeatIds: [],
        occupiedSeatIds: [],
        selectedSeatIds: [],
      });
      continue;
    }
    const [seatRows, baseAvailable, reserved, held, mine] = await Promise.all([
      getDb()
        .select({
          id: seats.id,
          rowIndex: seats.rowIndex,
          columnIndex: seats.columnIndex,
          rowLabel: seats.rowLabel,
          columnLabel: seats.columnLabel,
          kind: seats.kind,
          selectable: seats.selectable,
          golden: seats.golden,
        })
        .from(seats)
        .where(eq(seats.hallId, step.hallId))
        .orderBy(asc(seats.rowIndex), asc(seats.columnIndex)),
      getDb()
        .select({ seatId: eventSeats.seatId })
        .from(eventSeats)
        .where(eq(eventSeats.eventId, step.eventId)),
      getDb()
        .select({ seatId: reservationSeats.seatId })
        .from(reservationSeats)
        .where(eq(reservationSeats.eventId, step.eventId)),
      getDb()
        .select({ seatId: consecutiveCheckinSeatHolds.seatId })
        .from(consecutiveCheckinSeatHolds)
        .where(
          and(
            eq(consecutiveCheckinSeatHolds.eventId, step.eventId),
            ne(consecutiveCheckinSeatHolds.workflowId, workflow.id),
            gt(consecutiveCheckinSeatHolds.expiresAt, new Date(now)),
          ),
        ),
      getDb()
        .select({ seatId: consecutiveCheckinSeatHolds.seatId })
        .from(consecutiveCheckinSeatHolds)
        .where(
          and(
            eq(consecutiveCheckinSeatHolds.eventId, step.eventId),
            eq(consecutiveCheckinSeatHolds.workflowId, workflow.id),
            gt(consecutiveCheckinSeatHolds.expiresAt, new Date(now)),
          ),
        ),
    ]);
    const availableSeatIds = effectiveEventAvailability(
      seatRows.map((seat) => ({
        id: seat.id,
        columnIndex: seat.columnIndex,
        kind: seat.kind,
        templateSelectable: seat.selectable,
      })),
      baseAvailable.map((row) => row.seatId),
      step.lockedSeatHalf,
      step.centerAfterColumn,
    );
    steps.push({
      eventId: step.eventId,
      eventName: step.eventName,
      lotteryEnabled: step.lotteryEnabled,
      centerAfterColumn: step.centerAfterColumn,
      ticketTotal: step.ticketTotal,
      historical: step.historical,
      sortOrder: step.sortOrder,
      tickets: ticketRows,
      confirmedAt: null,
      confirmedSeats: [],
      lotteryResults,
      lotteryChances: ticketRows.reduce(
        (sum, ticket) => sum + (ticket.lotteryEligible ? ticket.quantity : 0),
        0,
      ),
      seats: seatRows,
      availableSeatIds,
      occupiedSeatIds: [...reserved, ...held].map((row) => row.seatId),
      selectedSeatIds: mine.map((row) => row.seatId),
    });
  }
  return {
    id: workflow.id,
    status: workflow.status,
    claimedAt: workflow.claimedAt.toISOString(),
    hardExpiresAt: workflow.hardExpiresAt.toISOString(),
    needsLocation: await consecutiveWorkflowNeedsLocation(workflow.id),
    steps,
  };
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

export async function finalizeConsecutiveWorkflow(
  workflowId: string,
  deviceHash: string,
  code: string,
  now = Date.now(),
) {
  await workflowAuthorization(workflowId, deviceHash, code);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const alreadyCompleted = await getDb().transaction(
        async (tx) => {
          const [workflow] = await tx
            .select({
              status: consecutiveCheckinWorkflows.status,
              hardExpiresAt: consecutiveCheckinWorkflows.hardExpiresAt,
              heartbeatAt: consecutiveCheckinWorkflows.heartbeatAt,
              deviceHash: consecutiveCheckinWorkflows.deviceHash,
            })
            .from(consecutiveCheckinWorkflows)
            .where(eq(consecutiveCheckinWorkflows.id, workflowId))
            .limit(1)
            .for("update");
          if (!workflow || workflow.deviceHash !== deviceHash)
            throw new DomainError(errorCodes.unauthorized, "连签会话无效", 401);
          if (workflow.status === "completed") return true;
          if (
            workflow.status !== "active" ||
            workflow.hardExpiresAt.getTime() <= now ||
            workflow.heartbeatAt.getTime() <= now - consecutiveLeaseMs
          )
            throw new DomainError(errorCodes.consecutiveWorkflowExpired, "连签已过期", 409);

          const steps = await tx
            .select({
              eventId: consecutiveCheckinWorkflowEvents.eventId,
              participantId: consecutiveCheckinWorkflowEvents.participantId,
              historical: consecutiveCheckinWorkflowEvents.historical,
              sortOrder: consecutiveCheckinWorkflowEvents.sortOrder,
              ticketTotal: participants.ticketTotal,
            })
            .from(consecutiveCheckinWorkflowEvents)
            .innerJoin(
              participants,
              eq(participants.id, consecutiveCheckinWorkflowEvents.participantId),
            )
            .where(eq(consecutiveCheckinWorkflowEvents.workflowId, workflowId))
            .orderBy(asc(consecutiveCheckinWorkflowEvents.sortOrder));
          const eventRows = await tx
            .select({
              id: events.id,
              name: events.name,
              status: events.status,
              version: events.version,
              lotteryEnabled: events.lotteryEnabled,
              participationMode: events.participationMode,
              expectedLotteryTickets: events.expectedLotteryTickets,
              lotteryPoolBonus: events.lotteryPoolBonus,
            })
            .from(events)
            .where(
              inArray(
                events.id,
                steps.map((step) => step.eventId),
              ),
            )
            .orderBy(asc(events.id))
            .for("update");
          if (eventRows.some((event) => event.status !== "open"))
            throw new DomainError(
              errorCodes.consecutiveWorkflowUnavailable,
              "部分连签活动已经关闭",
              409,
            );

          for (const step of steps.filter((item) => !item.historical)) {
            const holds = await tx
              .select({ seatId: consecutiveCheckinSeatHolds.seatId })
              .from(consecutiveCheckinSeatHolds)
              .where(
                and(
                  eq(consecutiveCheckinSeatHolds.workflowId, workflowId),
                  eq(consecutiveCheckinSeatHolds.eventId, step.eventId),
                  gt(consecutiveCheckinSeatHolds.expiresAt, new Date(now)),
                ),
              );
            if (holds.length !== step.ticketTotal)
              throw new DomainError(errorCodes.consecutiveSeatHeld, "部分临时座位已经失效", 409);
            const [reservation] = await tx
              .insert(reservations)
              .values({ eventId: step.eventId, participantId: step.participantId })
              .returning({ id: reservations.id });
            if (!reservation) throw new Error("Consecutive reservation creation failed");
            await tx.insert(reservationSeats).values(
              holds.map((hold) => ({
                reservationId: reservation.id,
                eventId: step.eventId,
                seatId: hold.seatId,
              })),
            );
            await tx
              .update(events)
              .set({ version: sql`${events.version} + 1` })
              .where(eq(events.id, step.eventId));
            await tx.insert(eventAuditLogs).values({
              eventId: step.eventId,
              participantId: step.participantId,
              action: "seat_confirmed",
              details: {
                reservationId: reservation.id,
                workflowId,
                seatIds: holds.map((hold) => hold.seatId),
              },
            });

            const currentEvent = eventRows.find((event) => event.id === step.eventId)!;
            if (!currentEvent.lotteryEnabled) continue;
            const [eligible, allDraws, prizes, awarded] = await Promise.all([
              tx
                .select({
                  total: sql<number>`coalesce(sum(${participantTickets.quantity}), 0)::int`,
                })
                .from(participantTickets)
                .innerJoin(ticketTypes, eq(ticketTypes.id, participantTickets.ticketTypeId))
                .where(
                  and(
                    eq(participantTickets.participantId, step.participantId),
                    eq(ticketTypes.eventId, step.eventId),
                    eq(ticketTypes.lotteryEligible, true),
                  ),
                ),
              tx
                .select({ value: count() })
                .from(lotteryDraws)
                .where(eq(lotteryDraws.eventId, step.eventId)),
              tx
                .select()
                .from(lotteryPrizes)
                .where(eq(lotteryPrizes.eventId, step.eventId))
                .orderBy(asc(lotteryPrizes.sortOrder)),
              tx
                .select({ prizeId: lotteryDraws.prizeId, value: count() })
                .from(lotteryDraws)
                .where(
                  and(
                    eq(lotteryDraws.eventId, step.eventId),
                    sql`${lotteryDraws.prizeId} is not null`,
                  ),
                )
                .groupBy(lotteryDraws.prizeId),
            ]);
            const drawCount = Number(eligible[0]?.total ?? 0);
            if (drawCount === 0) continue;
            const totalPool =
              (currentEvent.expectedLotteryTickets ?? 0) + currentEvent.lotteryPoolBonus;
            let remainingPool = totalPool - Number(allDraws[0]?.value ?? 0);
            if (remainingPool < drawCount)
              throw new DomainError(errorCodes.lotteryUnavailable, "抽奖名额不足", 409);
            const awardedByPrize = new Map(awarded.map((row) => [row.prizeId, Number(row.value)]));
            const remainingPrizes = prizes.map((prize) => ({
              ...prize,
              remaining: prize.quantity - (awardedByPrize.get(prize.id) ?? 0),
            }));
            if (remainingPrizes.reduce((sum, prize) => sum + prize.remaining, 0) > remainingPool)
              throw new DomainError(errorCodes.lotteryUnavailable, "奖池配置已失效", 409);
            const results: Array<{ drawIndex: number; prizeName: string | null }> = [];
            for (let drawIndex = 0; drawIndex < drawCount; drawIndex += 1) {
              const prizeIndex = prizeIndexForRoll(
                remainingPrizes,
                remainingPool,
                randomInt(remainingPool),
              );
              const won = prizeIndex === null ? null : (remainingPrizes[prizeIndex] ?? null);
              if (won) won.remaining -= 1;
              results.push({ drawIndex, prizeName: won?.name ?? null });
              await tx.insert(lotteryDraws).values({
                eventId: step.eventId,
                participantId: step.participantId,
                drawIndex,
                prizeId: won?.id ?? null,
                prizeName: won?.name ?? null,
              });
              remainingPool -= 1;
            }
            await tx.insert(eventAuditLogs).values({
              eventId: step.eventId,
              participantId: step.participantId,
              action: "lottery_drawn",
              details: {
                workflowId,
                drawCount,
                prizes: results.map((result) => result.prizeName),
              },
            });
          }
          await tx
            .delete(consecutiveCheckinSeatHolds)
            .where(eq(consecutiveCheckinSeatHolds.workflowId, workflowId));
          await tx
            .update(consecutiveCheckinWorkflows)
            .set({ status: "completed", completedAt: new Date(now) })
            .where(eq(consecutiveCheckinWorkflows.id, workflowId));
          await tx.insert(eventAuditLogs).values(
            steps.map((step) => ({
              eventId: step.eventId,
              participantId: step.participantId,
              action: "consecutive_checkin_completed" as const,
              details: { workflowId, historical: step.historical },
            })),
          );
          return false;
        },
        { isolationLevel: "serializable" },
      );
      return { alreadyCompleted };
    } catch (error) {
      const info = postgresErrorInfo(error);
      if (info.code === "40001" && attempt < 2) continue;
      if (info.code === "23505")
        throw new DomainError(errorCodes.consecutiveSeatHeld, "座位状态已变化", 409);
      throw error;
    }
  }
  throw new DomainError(errorCodes.consecutiveWorkflowUnavailable, "连签提交失败", 409);
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

export async function findRestorableConsecutiveWorkflow(
  code: string,
  deviceHash: string,
  now = Date.now(),
) {
  await expireInactiveWorkflows(now);
  const [workflow] = await getDb()
    .select({ id: consecutiveCheckinWorkflows.id })
    .from(consecutiveCheckinWorkflows)
    .innerJoin(events, eq(events.id, consecutiveCheckinWorkflows.sourceEventId))
    .where(
      and(
        eq(events.publicCode, code),
        eq(consecutiveCheckinWorkflows.deviceHash, deviceHash),
        activeAt(now),
      ),
    )
    .limit(1);
  return workflow ?? null;
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

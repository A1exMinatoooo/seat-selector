import "server-only";

import { randomInt } from "node:crypto";
import { and, asc, count, eq, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { eventAuditLogs, events, lotteryDraws, lotteryPrizes, participantTickets, reservations, ticketTypes } from "@/server/db/schema";
import { DomainError, errorCodes } from "@/shared/errors";
import { postgresErrorInfo } from "@/shared/postgres-error";
import { prizeIndexForRoll } from "./lottery-rules";

export type LotteryResult = { drawIndex: number; prizeName: string | null };

async function existingResults(eventId: string, participantId: string): Promise<LotteryResult[]> {
  return getDb().select({ drawIndex: lotteryDraws.drawIndex, prizeName: lotteryDraws.prizeName }).from(lotteryDraws).where(and(eq(lotteryDraws.eventId, eventId), eq(lotteryDraws.participantId, participantId))).orderBy(asc(lotteryDraws.drawIndex));
}

export async function drawLottery(eventId: string, participantId: string): Promise<LotteryResult[]> {
  const existing = await existingResults(eventId, participantId);
  if (existing.length) return existing;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await getDb().transaction(async (tx) => {
        const [event, reservation, participantDrawCount] = await Promise.all([
          tx.select({ enabled: events.lotteryEnabled, status: events.status }).from(events).where(eq(events.id, eventId)).limit(1),
          tx.select({ id: reservations.id }).from(reservations).where(and(eq(reservations.eventId, eventId), eq(reservations.participantId, participantId))).limit(1),
          tx.select({ value: count() }).from(lotteryDraws).where(and(eq(lotteryDraws.eventId, eventId), eq(lotteryDraws.participantId, participantId))),
        ]);
        if (!event[0]?.enabled || event[0].status !== "open" || !reservation[0]) throw new DomainError(errorCodes.lotteryUnavailable, "Lottery is unavailable", 409);
        if (Number(participantDrawCount[0]?.value ?? 0) > 0) return tx.select({ drawIndex: lotteryDraws.drawIndex, prizeName: lotteryDraws.prizeName }).from(lotteryDraws).where(and(eq(lotteryDraws.eventId, eventId), eq(lotteryDraws.participantId, participantId))).orderBy(asc(lotteryDraws.drawIndex));

        const [eligibleForEvent, eligibleForParticipant, allDraws, prizes, awarded] = await Promise.all([
          tx.select({ total: sql<number>`coalesce(sum(${participantTickets.quantity}), 0)::int` }).from(participantTickets).innerJoin(ticketTypes, eq(participantTickets.ticketTypeId, ticketTypes.id)).where(and(eq(ticketTypes.eventId, eventId), eq(ticketTypes.lotteryEligible, true))),
          tx.select({ total: sql<number>`coalesce(sum(${participantTickets.quantity}), 0)::int` }).from(participantTickets).innerJoin(ticketTypes, eq(participantTickets.ticketTypeId, ticketTypes.id)).where(and(eq(participantTickets.participantId, participantId), eq(ticketTypes.eventId, eventId), eq(ticketTypes.lotteryEligible, true))),
          tx.select({ value: count() }).from(lotteryDraws).where(eq(lotteryDraws.eventId, eventId)),
          tx.select().from(lotteryPrizes).where(eq(lotteryPrizes.eventId, eventId)).orderBy(asc(lotteryPrizes.sortOrder)),
          tx.select({ prizeId: lotteryDraws.prizeId, value: count() }).from(lotteryDraws).where(and(eq(lotteryDraws.eventId, eventId), sql`${lotteryDraws.prizeId} is not null`)).groupBy(lotteryDraws.prizeId),
        ]);
        const drawCount = Number(eligibleForParticipant[0]?.total ?? 0);
        const totalPool = Number(eligibleForEvent[0]?.total ?? 0);
        let remainingPool = totalPool - Number(allDraws[0]?.value ?? 0);
        if (drawCount < 1 || remainingPool < drawCount) throw new DomainError(errorCodes.lotteryUnavailable, "No lottery chances available", 409);

        const awardedByPrize = new Map(awarded.map((row) => [row.prizeId, Number(row.value)]));
        const remainingPrizes = prizes.map((prize) => ({ ...prize, remaining: prize.quantity - (awardedByPrize.get(prize.id) ?? 0) }));
        if (remainingPrizes.reduce((sum, prize) => sum + prize.remaining, 0) > remainingPool) throw new DomainError(errorCodes.lotteryUnavailable, "Prize inventory exceeds lottery pool", 409);

        const results: LotteryResult[] = [];
        for (let drawIndex = 0; drawIndex < drawCount; drawIndex += 1) {
          const roll = randomInt(remainingPool);
          const prizeIndex = prizeIndexForRoll(remainingPrizes, remainingPool, roll);
          const won = prizeIndex === null ? null : remainingPrizes[prizeIndex] ?? null;
          if (won) won.remaining -= 1;
          results.push({ drawIndex, prizeName: won?.name ?? null });
          await tx.insert(lotteryDraws).values({ eventId, participantId, drawIndex, prizeId: won?.id ?? null, prizeName: won?.name ?? null });
          remainingPool -= 1;
        }
        await tx.insert(eventAuditLogs).values({ eventId, participantId, action: "lottery_drawn", details: { drawCount, prizes: results.map((result) => result.prizeName) } });
        return results;
      }, { isolationLevel: "serializable" });
    } catch (error) {
      const { code } = postgresErrorInfo(error);
      if ((code === "40001" || code === "23505") && attempt < 2) continue;
      if (code === "23505") return existingResults(eventId, participantId);
      throw error;
    }
  }
  throw new DomainError(errorCodes.lotteryUnavailable, "Lottery could not be completed", 409);
}

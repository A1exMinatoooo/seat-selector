import "server-only";

import { and, asc, desc, eq, gte, inArray, lt } from "drizzle-orm";
import type { DailySeatRecordSource } from "@/server/domain/daily-seat-records";
import { getDb } from "./client";
import { cinemas, events, halls, lotteryDraws, participants, participantTickets, reservations, reservationSeats, seats, ticketTypes } from "./schema";

export async function findDailySeatRecordRows(deviceHash: string, start: Date, end: Date): Promise<DailySeatRecordSource> {
  const reservationRows = await getDb()
    .select({
      reservationId: reservations.id,
      participantId: reservations.participantId,
      eventName: events.name,
      cinemaName: cinemas.name,
      hallName: halls.name,
      startsAt: events.startsAt,
      confirmedAt: reservations.confirmedAt,
    })
    .from(reservations)
    .innerJoin(participants, and(eq(participants.id, reservations.participantId), eq(participants.eventId, reservations.eventId)))
    .innerJoin(events, eq(events.id, reservations.eventId))
    .innerJoin(halls, eq(halls.id, events.hallId))
    .innerJoin(cinemas, eq(cinemas.id, halls.cinemaId))
    .where(and(eq(participants.deviceHash, deviceHash), gte(reservations.confirmedAt, start), lt(reservations.confirmedAt, end)))
    .orderBy(desc(reservations.confirmedAt));

  if (reservationRows.length === 0) return { reservations: [], seats: [], tickets: [], lotteryResults: [] };

  const reservationIds = reservationRows.map((row) => row.reservationId);
  const participantIds = [...new Set(reservationRows.map((row) => row.participantId))];
  const [seatRows, ticketRows, lotteryRows] = await Promise.all([
    getDb()
      .select({ reservationId: reservationSeats.reservationId, rowLabel: seats.rowLabel, columnLabel: seats.columnLabel })
      .from(reservationSeats)
      .innerJoin(seats, eq(seats.id, reservationSeats.seatId))
      .where(inArray(reservationSeats.reservationId, reservationIds))
      .orderBy(asc(seats.rowIndex), asc(seats.columnIndex)),
    getDb()
      .select({ participantId: participantTickets.participantId, name: ticketTypes.name, quantity: participantTickets.quantity })
      .from(participantTickets)
      .innerJoin(ticketTypes, eq(ticketTypes.id, participantTickets.ticketTypeId))
      .where(inArray(participantTickets.participantId, participantIds))
      .orderBy(asc(ticketTypes.sortOrder)),
    getDb()
      .select({ participantId: lotteryDraws.participantId, drawIndex: lotteryDraws.drawIndex, prizeName: lotteryDraws.prizeName })
      .from(lotteryDraws)
      .where(inArray(lotteryDraws.participantId, participantIds))
      .orderBy(asc(lotteryDraws.drawIndex)),
  ]);

  return { reservations: reservationRows, seats: seatRows, tickets: ticketRows, lotteryResults: lotteryRows };
}

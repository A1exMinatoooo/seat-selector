import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { events, participants, reservations, reservationSeats, seats } from "@/server/db/schema";
import { DomainError, errorCodes } from "@/shared/errors";

type ConfirmInput = { eventId: string; participantId: string; hallId: string; seatIds: string[]; ticketTotal: number };
export async function confirmSeats(input: ConfirmInput): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await getDb().transaction(async (tx) => {
        const [event] = await tx.select({ status: events.status }).from(events).where(eq(events.id, input.eventId)).limit(1);
        if (!event || event.status !== "open") throw new DomainError(errorCodes.forbidden, "Event is not open", 403);
        const [person] = await tx.select({ total: participants.ticketTotal }).from(participants).where(and(eq(participants.id, input.participantId), eq(participants.eventId, input.eventId))).limit(1);
        if (!person || person.total !== input.ticketTotal || input.seatIds.length !== person.total || new Set(input.seatIds).size !== person.total) throw new DomainError(errorCodes.validation, "Seat count does not match tickets", 400);
        const valid = await tx.select({ id: seats.id }).from(seats).where(and(eq(seats.hallId, input.hallId), eq(seats.kind, "seat"), eq(seats.selectable, true), inArray(seats.id, input.seatIds)));
        if (valid.length !== person.total) throw new DomainError(errorCodes.validation, "Invalid seat", 400);
        const [reservation] = await tx.insert(reservations).values({ eventId: input.eventId, participantId: input.participantId }).returning({ id: reservations.id });
        if (!reservation) throw new Error("Reservation creation did not return an id");
        await tx.insert(reservationSeats).values(input.seatIds.map((seatId) => ({ reservationId: reservation.id, eventId: input.eventId, seatId })));
        await tx.update(events).set({ version: sql`${events.version} + 1` }).where(and(eq(events.id, input.eventId), eq(events.status, "open")));
        return reservation.id;
      }, { isolationLevel: "serializable" });
    } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
      if (code === "40001" && attempt < 2) continue;
      if (code === "23505") throw new DomainError(errorCodes.conflict, "One or more seats are no longer available", 409);
      throw error;
    }
  }
  throw new DomainError(errorCodes.conflict, "Could not serialize reservation", 409);
}

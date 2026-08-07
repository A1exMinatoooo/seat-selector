import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { eventAuditLogs, events, participants, reservations, reservationSeats, seats } from "@/server/db/schema";
import { recordEventAudit } from "@/server/domain/event-audit";
import { DomainError, errorCodes } from "@/shared/errors";
import { postgresErrorInfo } from "@/shared/postgres-error";

type ConfirmInput = { eventId: string; participantId: string; hallId: string; seatIds: string[]; ticketTotal: number };

async function recordSeatConflict(input: ConfirmInput, reason: string): Promise<void> {
  try {
    const requested = await getDb().select({ id: seats.id, rowLabel: seats.rowLabel, columnLabel: seats.columnLabel }).from(seats).where(and(eq(seats.hallId, input.hallId), inArray(seats.id, input.seatIds)));
    const labelById = new Map(requested.map((seat) => [seat.id, `${seat.rowLabel}${seat.columnLabel}`]));
    await recordEventAudit({
      eventId: input.eventId,
      participantId: input.participantId,
      action: "seat_conflict",
      details: { reason, requestedSeats: input.seatIds.map((seatId) => labelById.get(seatId) ?? "未知座位") },
    });
  } catch (error) {
    console.error(JSON.stringify({ level: "error", message: "seat_conflict_audit_failed", error: error instanceof Error ? error.message : "Unknown error" }));
  }
}

export async function confirmSeats(input: ConfirmInput): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await getDb().transaction(async (tx) => {
        const [event] = await tx.select({ status: events.status }).from(events).where(eq(events.id, input.eventId)).limit(1);
        if (!event || event.status !== "open") throw new DomainError(errorCodes.forbidden, "Event is not open", 403);
        const [person] = await tx.select({ total: participants.ticketTotal }).from(participants).where(and(eq(participants.id, input.participantId), eq(participants.eventId, input.eventId))).limit(1);
        if (!person || person.total !== input.ticketTotal || input.seatIds.length !== person.total || new Set(input.seatIds).size !== person.total) throw new DomainError(errorCodes.validation, "Seat count does not match tickets", 400);
        const valid = await tx.select({ id: seats.id, rowLabel: seats.rowLabel, columnLabel: seats.columnLabel }).from(seats).where(and(eq(seats.hallId, input.hallId), eq(seats.kind, "seat"), eq(seats.selectable, true), inArray(seats.id, input.seatIds)));
        if (valid.length !== person.total) throw new DomainError(errorCodes.validation, "Invalid seat", 400);
        const [reservation] = await tx.insert(reservations).values({ eventId: input.eventId, participantId: input.participantId }).returning({ id: reservations.id });
        if (!reservation) throw new Error("Reservation creation did not return an id");
        await tx.insert(reservationSeats).values(input.seatIds.map((seatId) => ({ reservationId: reservation.id, eventId: input.eventId, seatId })));
        await tx.update(events).set({ version: sql`${events.version} + 1` }).where(and(eq(events.id, input.eventId), eq(events.status, "open")));
        const labelById = new Map(valid.map((seat) => [seat.id, `${seat.rowLabel}${seat.columnLabel}`]));
        await tx.insert(eventAuditLogs).values({ eventId: input.eventId, participantId: input.participantId, action: "seat_confirmed", details: { reservationId: reservation.id, seats: input.seatIds.map((seatId) => labelById.get(seatId) ?? "未知座位") } });
        return reservation.id;
      }, { isolationLevel: "serializable" });
    } catch (error) {
      const { code, constraint } = postgresErrorInfo(error);
      if (code === "40001") {
        if (attempt < 2) continue;
        await recordSeatConflict(input, "serialization_failure");
        throw new DomainError(errorCodes.conflict, "Could not serialize reservation", 409);
      }
      if (code === "23505") {
        await recordSeatConflict(input, constraint ?? "unique_constraint");
        throw new DomainError(errorCodes.conflict, "One or more seats are no longer available", 409);
      }
      throw error;
    }
  }
  throw new DomainError(errorCodes.conflict, "Could not serialize reservation", 409);
}

import { asc, eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { eventSeats, events, halls, reservationSeats, seats } from "@/server/db/schema";
import { effectiveEventAvailability } from "@/server/domain/event-seat-availability";
import { requireParticipantForEvent } from "@/server/security/participant-auth";
import { apiFailure } from "@/server/security/request";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await params;
    const participant = await requireParticipantForEvent(code);
    const version = Number(new URL(request.url).searchParams.get("version") ?? 0);
    if (version === participant.version) return new Response(null, { status: 204 });
    const [event, occupied, baseAvailable, hallSeats] = await Promise.all([
      getDb()
        .select({
          lockedSeatHalf: events.lockedSeatHalf,
          centerAfterColumn: halls.centerAfterColumn,
        })
        .from(events)
        .innerJoin(halls, eq(events.hallId, halls.id))
        .where(eq(events.id, participant.eventId))
        .limit(1),
      getDb()
        .select({ seatId: reservationSeats.seatId })
        .from(reservationSeats)
        .where(eq(reservationSeats.eventId, participant.eventId)),
      getDb()
        .select({ seatId: eventSeats.seatId })
        .from(eventSeats)
        .where(eq(eventSeats.eventId, participant.eventId)),
      getDb()
        .select({
          id: seats.id,
          columnIndex: seats.columnIndex,
          kind: seats.kind,
          templateSelectable: seats.selectable,
        })
        .from(seats)
        .where(eq(seats.hallId, participant.hallId))
        .orderBy(asc(seats.rowIndex), asc(seats.columnIndex)),
    ]);
    const configuration = event[0];
    const availableSeatIds = effectiveEventAvailability(
      hallSeats,
      baseAvailable.map((row) => row.seatId),
      configuration?.lockedSeatHalf ?? null,
      configuration?.centerAfterColumn ?? null,
    );
    return Response.json({
      version: participant.version,
      occupiedSeatIds: occupied.map((row) => row.seatId),
      availableSeatIds,
    });
  } catch (error) {
    return apiFailure(error);
  }
}

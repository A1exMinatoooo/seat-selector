import { and, eq, inArray, ne } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/server/db/client";
import { reservations, reservationSeats, seats } from "@/server/db/schema";
import { recordEventAudit } from "@/server/domain/event-audit";
import { requireParticipantForEvent } from "@/server/security/participant-auth";
import { apiFailure, assertSameOrigin } from "@/server/security/request";
import { DomainError, errorCodes } from "@/shared/errors";

const schema = z.object({
  seatIds: z.array(z.string().uuid()).min(1).max(20).transform((values) => [...new Set(values)]),
});

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    assertSameOrigin(request);
    const { code } = await params;
    const participant = await requireParticipantForEvent(code);
    if (participant.status !== "open") throw new DomainError(errorCodes.forbidden, "Event closed", 403);
    const { seatIds } = schema.parse(await request.json());
    const displaced = await getDb()
      .select({ id: seats.id, rowLabel: seats.rowLabel, columnLabel: seats.columnLabel })
      .from(reservationSeats)
      .innerJoin(reservations, eq(reservationSeats.reservationId, reservations.id))
      .innerJoin(seats, eq(reservationSeats.seatId, seats.id))
      .where(and(eq(reservationSeats.eventId, participant.eventId), inArray(reservationSeats.seatId, seatIds), ne(reservations.participantId, participant.participantId)));
    if (!displaced.length) return new Response(null, { status: 204 });
    const labelById = new Map(displaced.map((seat) => [seat.id, `${seat.rowLabel}${seat.columnLabel}`]));
    await recordEventAudit({
      eventId: participant.eventId,
      participantId: participant.participantId,
      action: "selection_displaced",
      details: { seats: seatIds.flatMap((seatId) => labelById.get(seatId) ?? []) },
    });
    return Response.json({ recorded: displaced.length });
  } catch (error) {
    return apiFailure(error);
  }
}

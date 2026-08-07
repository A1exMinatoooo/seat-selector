import { eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { eventSeats, reservationSeats } from "@/server/db/schema";
import { requireParticipantForEvent } from "@/server/security/participant-auth";
import { apiFailure } from "@/server/security/request";
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) { try { const { code } = await params; const participant = await requireParticipantForEvent(code); const version = Number(new URL(request.url).searchParams.get("version") ?? 0); if (version === participant.version) return new Response(null, { status: 204 }); const [occupied, available] = await Promise.all([getDb().select({ seatId: reservationSeats.seatId }).from(reservationSeats).where(eq(reservationSeats.eventId, participant.eventId)), getDb().select({ seatId: eventSeats.seatId }).from(eventSeats).where(eq(eventSeats.eventId, participant.eventId))]); return Response.json({ version: participant.version, occupiedSeatIds: occupied.map((row) => row.seatId), availableSeatIds: available.map((row) => row.seatId) }); } catch (error) { return apiFailure(error); } }

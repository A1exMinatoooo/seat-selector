import { z } from "zod";
import { confirmSeats } from "@/server/domain/seating";
import { isLocationCheckRequired } from "@/server/domain/location-check";
import { requireParticipantForEvent } from "@/server/security/participant-auth";
import { getLocationClaim } from "@/server/security/participant-session";
import { apiFailure, assertSameOrigin } from "@/server/security/request";
import { DomainError, errorCodes } from "@/shared/errors";
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) { try { assertSameOrigin(request); const { code } = await params; const participant = await requireParticipantForEvent(code); if (participant.status !== "open") throw new DomainError(errorCodes.forbidden, "Event closed", 403); const location = await getLocationClaim(); if (isLocationCheckRequired(participant.locationCheckEnabled, participant.locationExemptAt) && (!location || location.eventId !== participant.eventId || location.participantId !== participant.participantId)) throw new DomainError(errorCodes.locationRequired, "Fresh location required", 403); const { seatIds } = z.object({ seatIds: z.array(z.string().uuid()).min(1).max(20) }).parse(await request.json()); const reservationId = await confirmSeats({ ...participant, seatIds }); return Response.json({ reservationId }); } catch (error) { return apiFailure(error); } }

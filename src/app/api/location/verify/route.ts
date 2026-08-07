import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { distanceMeters, isLocationAllowed, maximumLocationAccuracy } from "@/features/locations/distance";
import { getDb } from "@/server/db/client";
import { events, locationPresets, participants } from "@/server/db/schema";
import { recordEventAudit } from "@/server/domain/event-audit";
import { getParticipantClaim, setLocationClaim } from "@/server/security/participant-session";
import { apiFailure, assertSameOrigin } from "@/server/security/request";
import { DomainError, errorCodes } from "@/shared/errors";

const schema = z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), accuracy: z.number().positive().max(10_000), capturedAt: z.number().int() });

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = schema.parse(await request.json());
    const claim = await getParticipantClaim();
    if (!claim) throw new DomainError(errorCodes.unauthorized, "Participant required", 401);
    const [row] = await getDb().select({ latitude: locationPresets.latitude, longitude: locationPresets.longitude, radius: events.radiusMeters, enabled: events.locationCheckEnabled, exempt: participants.locationExemptAt }).from(events).innerJoin(locationPresets, eq(events.locationId, locationPresets.id)).innerJoin(participants, and(eq(participants.eventId, events.id), eq(participants.id, claim.participantId))).where(eq(events.id, claim.eventId)).limit(1);
    if (!row) throw new DomainError(errorCodes.notFound, "Event missing", 404);
    if (!row.enabled) return Response.json({ ok: true, locationCheckEnabled: false });
    if (Math.abs(Date.now() - input.capturedAt) > 30_000) {
      await recordEventAudit({ eventId: claim.eventId, participantId: claim.participantId, action: "location_rejected", details: { stage: "server", reason: "stale_position", accuracyMeters: Math.round(input.accuracy), radiusMeters: row.radius } });
      throw new DomainError(errorCodes.locationRequired, "Stale position", 403);
    }
    const distance = Math.round(distanceMeters(input, row));
    const accuracy = Math.round(input.accuracy);
    if (!row.exempt && !isLocationAllowed(distance, input.accuracy, row.radius)) {
      const reason = input.accuracy > maximumLocationAccuracy(row.radius) ? "insufficient_accuracy" : "outside_range";
      await recordEventAudit({ eventId: claim.eventId, participantId: claim.participantId, action: "location_rejected", details: { stage: "server", reason, distanceMeters: distance, accuracyMeters: accuracy, radiusMeters: row.radius } });
      throw new DomainError(errorCodes.locationRequired, "Outside range", 403);
    }
    await recordEventAudit({ eventId: claim.eventId, participantId: claim.participantId, action: "location_verified", details: { distanceMeters: distance, accuracyMeters: accuracy, radiusMeters: row.radius, exempt: Boolean(row.exempt) } });
    await setLocationClaim({ eventId: claim.eventId, participantId: claim.participantId, verifiedAt: Date.now() });
    return Response.json({ ok: true, distanceMeters: distance, exempt: Boolean(row.exempt) });
  } catch (error) {
    return apiFailure(error);
  }
}

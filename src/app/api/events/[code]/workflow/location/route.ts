import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  distanceMeters,
  isLocationAllowed,
  maximumLocationAccuracy,
} from "@/features/locations/distance";
import { getDb } from "@/server/db/client";
import {
  consecutiveCheckinWorkflowEvents,
  events,
  locationPresets,
  participants,
} from "@/server/db/schema";
import { recordEventAudit } from "@/server/domain/event-audit";
import { requireConsecutiveWorkflowForEvent } from "@/server/security/participant-auth";
import { setConsecutiveLocationClaim } from "@/server/security/participant-session";
import { apiFailure, assertSameOrigin } from "@/server/security/request";
import { DomainError, errorCodes } from "@/shared/errors";

const schema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().positive().max(10_000),
  capturedAt: z.number().int(),
});

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    assertSameOrigin(request);
    const input = schema.parse(await request.json());
    const { code } = await params;
    const claim = await requireConsecutiveWorkflowForEvent(code);
    if (Math.abs(Date.now() - input.capturedAt) > 30_000)
      throw new DomainError(errorCodes.locationRequired, "Stale position", 403);
    const checks = await getDb()
      .select({
        eventId: events.id,
        participantId: participants.id,
        latitude: locationPresets.latitude,
        longitude: locationPresets.longitude,
        radius: events.radiusMeters,
        enabled: events.locationCheckEnabled,
        exempt: participants.locationExemptAt,
        historical: consecutiveCheckinWorkflowEvents.historical,
      })
      .from(consecutiveCheckinWorkflowEvents)
      .innerJoin(events, eq(events.id, consecutiveCheckinWorkflowEvents.eventId))
      .innerJoin(locationPresets, eq(locationPresets.id, events.locationId))
      .innerJoin(participants, eq(participants.id, consecutiveCheckinWorkflowEvents.participantId))
      .where(eq(consecutiveCheckinWorkflowEvents.workflowId, claim.workflowId));
    for (const check of checks) {
      if (check.historical || !check.enabled || check.exempt) continue;
      const distance = Math.round(distanceMeters(input, check));
      const accuracy = Math.round(input.accuracy);
      if (!isLocationAllowed(distance, input.accuracy, check.radius)) {
        const reason =
          input.accuracy > maximumLocationAccuracy(check.radius)
            ? "insufficient_accuracy"
            : "outside_range";
        await recordEventAudit({
          eventId: check.eventId,
          participantId: check.participantId,
          action: "location_rejected",
          details: {
            stage: "consecutive",
            reason,
            distanceMeters: distance,
            accuracyMeters: accuracy,
            radiusMeters: check.radius,
          },
        });
        throw new DomainError(errorCodes.locationRequired, "Outside range", 403);
      }
      await recordEventAudit({
        eventId: check.eventId,
        participantId: check.participantId,
        action: "location_verified",
        details: {
          stage: "consecutive",
          distanceMeters: distance,
          accuracyMeters: accuracy,
          radiusMeters: check.radius,
        },
      });
    }
    await setConsecutiveLocationClaim({ workflowId: claim.workflowId, verifiedAt: Date.now() });
    return Response.json({ ok: true });
  } catch (error) {
    return apiFailure(error);
  }
}

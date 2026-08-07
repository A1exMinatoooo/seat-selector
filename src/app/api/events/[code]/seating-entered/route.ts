import { recordEventAudit } from "@/server/domain/event-audit";
import { requireParticipantForEvent } from "@/server/security/participant-auth";
import { apiFailure, assertSameOrigin } from "@/server/security/request";
import { DomainError, errorCodes } from "@/shared/errors";

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    assertSameOrigin(request);
    const { code } = await params;
    const participant = await requireParticipantForEvent(code);
    if (participant.status !== "open") throw new DomainError(errorCodes.forbidden, "Event closed", 403);
    await recordEventAudit({
      eventId: participant.eventId,
      participantId: participant.participantId,
      action: "seating_entered",
      details: { deviceId: participant.deviceHash?.slice(0, 16) ?? "unknown" },
    });
    return Response.json({ ok: true });
  } catch (error) {
    return apiFailure(error);
  }
}

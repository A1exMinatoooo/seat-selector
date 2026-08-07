import { z } from "zod";
import { recordEventAudit } from "@/server/domain/event-audit";
import { requireParticipantForEvent } from "@/server/security/participant-auth";
import { apiFailure, assertSameOrigin } from "@/server/security/request";

const schema = z.object({ reason: z.enum(["permission_denied", "position_unavailable", "timeout", "unknown"]) });

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    assertSameOrigin(request);
    const { code } = await params;
    const participant = await requireParticipantForEvent(code);
    const { reason } = schema.parse(await request.json());
    await recordEventAudit({
      eventId: participant.eventId,
      participantId: participant.participantId,
      action: "location_rejected",
      details: { stage: "browser", reason },
    });
    return Response.json({ ok: true });
  } catch (error) {
    return apiFailure(error);
  }
}

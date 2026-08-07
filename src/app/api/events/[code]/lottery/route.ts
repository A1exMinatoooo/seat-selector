import { drawLottery } from "@/server/domain/lottery";
import { requireParticipantForEvent } from "@/server/security/participant-auth";
import { apiFailure, assertSameOrigin } from "@/server/security/request";

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    assertSameOrigin(request);
    const { code } = await params;
    const participant = await requireParticipantForEvent(code);
    const results = await drawLottery(participant.eventId, participant.participantId);
    return Response.json({ results });
  } catch (error) {
    return apiFailure(error);
  }
}

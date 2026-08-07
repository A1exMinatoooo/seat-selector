import { restoreParticipantForEvent } from "@/server/security/participant-auth";
import { apiFailure, assertSameOrigin } from "@/server/security/request";
import { DomainError, errorCodes } from "@/shared/errors";

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    assertSameOrigin(request);
    const participant = await restoreParticipantForEvent((await params).code);
    if (!participant) throw new DomainError(errorCodes.unauthorized, "Bound device required", 401);
    return Response.json({ ok: true });
  } catch (error) {
    return apiFailure(error);
  }
}

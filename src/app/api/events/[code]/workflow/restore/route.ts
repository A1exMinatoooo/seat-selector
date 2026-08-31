import { restoreConsecutiveWorkflowForEvent } from "@/server/security/participant-auth";
import { apiFailure, assertSameOrigin } from "@/server/security/request";
import { DomainError, errorCodes } from "@/shared/errors";

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    assertSameOrigin(request);
    const workflow = await restoreConsecutiveWorkflowForEvent((await params).code);
    if (!workflow) throw new DomainError(errorCodes.unauthorized, "Bound workflow required", 401);
    return Response.json({ ok: true });
  } catch (error) {
    return apiFailure(error);
  }
}

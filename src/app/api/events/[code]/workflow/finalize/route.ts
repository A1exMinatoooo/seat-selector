import {
  consecutiveWorkflowNeedsLocation,
  finalizeConsecutiveWorkflow,
  getConsecutiveWorkflowView,
} from "@/server/domain/consecutive-checkin-workflow";
import { requireConsecutiveWorkflowForEvent } from "@/server/security/participant-auth";
import { getConsecutiveLocationClaim } from "@/server/security/participant-session";
import { apiFailure, assertSameOrigin } from "@/server/security/request";
import { DomainError, errorCodes } from "@/shared/errors";

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    assertSameOrigin(request);
    const { code } = await params;
    const claim = await requireConsecutiveWorkflowForEvent(code);
    const location = await getConsecutiveLocationClaim();
    if (
      (await consecutiveWorkflowNeedsLocation(claim.workflowId)) &&
      (!location || location.workflowId !== claim.workflowId)
    )
      throw new DomainError(errorCodes.locationRequired, "Fresh location required", 403);
    const result = await finalizeConsecutiveWorkflow(
      claim.workflowId,
      claim.deviceHash,
      claim.code,
    );
    const view = await getConsecutiveWorkflowView(claim.workflowId, claim.deviceHash, claim.code);
    return Response.json({ ok: true, ...result, view });
  } catch (error) {
    return apiFailure(error);
  }
}

import { heartbeatConsecutiveWorkflow } from "@/server/domain/consecutive-checkin-workflow";
import { requireConsecutiveWorkflowForEvent } from "@/server/security/participant-auth";
import { apiFailure, assertSameOrigin } from "@/server/security/request";

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    assertSameOrigin(request);
    const { code } = await params;
    const claim = await requireConsecutiveWorkflowForEvent(code);
    const state = await heartbeatConsecutiveWorkflow(
      claim.workflowId,
      claim.deviceHash,
      claim.code,
    );
    return Response.json({
      hardExpiresAt: state.hardExpiresAt.toISOString(),
      leaseExpiresAt: state.leaseExpiresAt.toISOString(),
    });
  } catch (error) {
    return apiFailure(error);
  }
}

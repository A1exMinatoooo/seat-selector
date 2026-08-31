import { z } from "zod";
import {
  consecutiveWorkflowNeedsLocation,
  consecutiveWorkflowSeatState,
  replaceConsecutiveSeatHolds,
} from "@/server/domain/consecutive-checkin-workflow";
import { requireConsecutiveWorkflowForEvent } from "@/server/security/participant-auth";
import { getConsecutiveLocationClaim } from "@/server/security/participant-session";
import { apiFailure, assertSameOrigin } from "@/server/security/request";
import { DomainError, errorCodes } from "@/shared/errors";

const eventIdSchema = z.string().uuid();
const holdSchema = z.object({
  eventId: z.string().uuid(),
  seatIds: z.array(z.string().uuid()).min(1).max(20),
});

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const eventId = eventIdSchema.parse(new URL(request.url).searchParams.get("eventId"));
    const claim = await requireConsecutiveWorkflowForEvent(code);
    const state = await consecutiveWorkflowSeatState(
      claim.workflowId,
      eventId,
      claim.deviceHash,
      claim.code,
    );
    return Response.json({ ...state, hardExpiresAt: state.hardExpiresAt.toISOString() });
  } catch (error) {
    return apiFailure(error);
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    assertSameOrigin(request);
    const { code } = await params;
    const input = holdSchema.parse(await request.json());
    const claim = await requireConsecutiveWorkflowForEvent(code);
    const location = await getConsecutiveLocationClaim();
    if (
      (await consecutiveWorkflowNeedsLocation(claim.workflowId)) &&
      (!location || location.workflowId !== claim.workflowId)
    )
      throw new DomainError(errorCodes.locationRequired, "Fresh location required", 403);
    const result = await replaceConsecutiveSeatHolds(
      claim.workflowId,
      input.eventId,
      input.seatIds,
      claim.deviceHash,
      claim.code,
    );
    return Response.json({
      ...result,
      leaseExpiresAt: result.leaseExpiresAt.toISOString(),
      hardExpiresAt: result.hardExpiresAt.toISOString(),
    });
  } catch (error) {
    return apiFailure(error);
  }
}

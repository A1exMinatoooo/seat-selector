import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { z } from "zod";
import { getDb } from "@/server/db/client";
import { hasCompletedReservationForDevice } from "@/server/db/participant-device";
import { events } from "@/server/db/schema";
import { consumeQrToken } from "@/server/domain/qr-entry";
import { claimTicketIssue } from "@/server/domain/ticket-issue";
import { rateLimit } from "@/server/security/rate-limit";
import { apiFailure, assertSameOrigin, clientAddress } from "@/server/security/request";
import { randomToken, tokenHash } from "@/server/security/crypto";
import {
  setConsecutiveWorkflowClaim,
  setEntryClaim,
  setParticipantClaim,
} from "@/server/security/participant-session";
import { DomainError, errorCodes } from "@/shared/errors";
const schema = z.object({ code: z.string().min(10).max(80), token: z.string().min(20).max(300) });
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    if (!rateLimit(`redeem:${clientAddress(request)}`, 30, 60_000))
      return Response.json({ error: "RATE_LIMITED" }, { status: 429 });
    const input = schema.parse(await request.json());
    const [event] = await getDb()
      .select({ id: events.id, status: events.status, participationMode: events.participationMode })
      .from(events)
      .where(eq(events.publicCode, input.code))
      .limit(1);
    if (!event)
      throw new DomainError(errorCodes.forbidden, "活动已关闭，请联系现场工作人员", 403);
    const jar = await cookies();
    const existingToken = jar.get("ps_device")?.value;
    const deviceHash = existingToken ? tokenHash(existingToken) : null;
    const selectionCompleted = deviceHash
      ? await hasCompletedReservationForDevice(input.code, deviceHash)
      : false;
    if (event.participationMode === "onsite") {
      if (event.status !== "open") {
        if (selectionCompleted)
          throw new DomainError(
            errorCodes.selectionAlreadyCompleted,
            "设备已完成本场选座",
            409,
          );
        throw new DomainError(errorCodes.forbidden, "活动已关闭，请联系现场工作人员", 403);
      }
      const deviceToken = existingToken ?? randomToken();
      let claim;
      try {
        claim = await claimTicketIssue(input.code, input.token, tokenHash(deviceToken));
      } catch (error) {
        if (
          selectionCompleted &&
          error instanceof DomainError &&
          (error.code === errorCodes.ticketIssueExpired ||
            error.code === errorCodes.ticketIssueClaimed ||
            error.code === errorCodes.eventConflict)
        )
          throw new DomainError(
            errorCodes.selectionAlreadyCompleted,
            "设备已完成本场选座",
            409,
          );
        throw error;
      }
      if (!existingToken)
        jar.set("ps_device", deviceToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 180 * 24 * 60 * 60,
        });
    if ("workflowId" in claim && typeof claim.workflowId === "string")
        await setConsecutiveWorkflowClaim({ workflowId: claim.workflowId, code: claim.code });
      else await setParticipantClaim(claim);
    } else {
      if (selectionCompleted)
        throw new DomainError(
          errorCodes.selectionAlreadyCompleted,
          "设备已完成本场选座",
          409,
        );
      if (event.status !== "open")
        throw new DomainError(errorCodes.forbidden, "活动已关闭，请联系现场工作人员", 403);
      await consumeQrToken(event.id, input.code, input.token);
      await setEntryClaim({ eventId: event.id, code: input.code });
    }
    return Response.json({ ok: true });
  } catch (error) {
    return apiFailure(error);
  }
}

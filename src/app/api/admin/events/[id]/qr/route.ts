import { z } from "zod";
import { getOrCreateQrToken } from "@/server/domain/qr-entry";
import {
  cancelConsecutiveWorkflow,
  listActiveConsecutiveWorkflows,
} from "@/server/domain/consecutive-checkin-workflow";
import {
  cancelTicketIssue,
  createTicketIssue,
  ticketIssueStatus,
} from "@/server/domain/ticket-issue";
import { env } from "@/server/env";
import { generateQrCodeDataUrl } from "@/server/qr-code";
import { hasAdminSession } from "@/server/security/admin-session";
import { apiFailure, assertSameOrigin } from "@/server/security/request";
import { DomainError, errorCodes } from "@/shared/errors";

const idSchema = z.string().uuid();
const allocationSchema = z.array(
  z.object({ ticketTypeId: z.string().uuid(), quantity: z.number().int() }),
);
const issueInputSchema = z.union([
  z.object({ allocation: allocationSchema }),
  z.object({
    allocations: z.array(z.object({ eventId: z.string().uuid(), allocation: allocationSchema })),
  }),
]);

function validatedId(value: string, label: string) {
  const parsed = idSchema.safeParse(value);
  if (!parsed.success) throw new DomainError(errorCodes.validation, `${label}格式不正确`, 400);
  return parsed.data;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasAdminSession())) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  try {
    const id = validatedId((await params).id, "活动编号");
    if (new URL(request.url).searchParams.get("workflows") === "active") {
      const workflows = await listActiveConsecutiveWorkflows(id);
      return Response.json({
        workflows: workflows.map((workflow) => ({
          ...workflow,
          claimedAt: workflow.claimedAt.toISOString(),
          hardExpiresAt: workflow.hardExpiresAt.toISOString(),
        })),
      });
    }
    const issueId = new URL(request.url).searchParams.get("issueId");
    if (issueId)
      return Response.json({
        status: await ticketIssueStatus(id, validatedId(issueId, "发行编号")),
      });
    const qr = await getOrCreateQrToken(id);
    const url = `${env().APP_URL}/e/${qr.publicCode}/join?t=${encodeURIComponent(qr.token)}`;
    return Response.json({
      image: await generateQrCodeDataUrl(url),
      expiresIn: qr.expiresIn,
      serverTime: qr.serverTime,
    });
  } catch (error) {
    return apiFailure(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasAdminSession())) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  try {
    assertSameOrigin(request);
    const parsed = issueInputSchema.safeParse(await request.json().catch(() => undefined));
    if (!parsed.success) throw new DomainError(errorCodes.validation, "发行信息格式不正确", 400);
    const eventId = validatedId((await params).id, "活动编号");
    const issue = await createTicketIssue(
      eventId,
      "allocations" in parsed.data ? parsed.data.allocations : parsed.data.allocation,
    );
    const url = `${env().APP_URL}/e/${issue.publicCode}/join?t=${encodeURIComponent(issue.token)}`;
    const image = await generateQrCodeDataUrl(url);
    return Response.json({
      issueId: issue.issueId,
      image,
      expiresIn: issue.expiresIn,
      expiresAt: issue.expiresAt.toISOString(),
      serverTime: new Date().toISOString(),
      allocation: issue.allocation,
      events: issue.events,
    });
  } catch (error) {
    return apiFailure(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasAdminSession())) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  try {
    assertSameOrigin(request);
    const eventId = validatedId((await params).id, "活动编号");
    const workflowId = new URL(request.url).searchParams.get("workflowId");
    if (workflowId)
      return Response.json({
        status: await cancelConsecutiveWorkflow(eventId, validatedId(workflowId, "连签流程编号")),
      });
    const issueId = new URL(request.url).searchParams.get("issueId");
    if (!issueId) throw new DomainError(errorCodes.validation, "缺少发行编号", 400);
    return Response.json({
      status: await cancelTicketIssue(eventId, validatedId(issueId, "发行编号")),
    });
  } catch (error) {
    return apiFailure(error);
  }
}

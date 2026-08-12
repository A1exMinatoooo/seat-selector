import { z } from "zod";
import { getOrCreateQrToken } from "@/server/domain/qr-entry";
import { createTicketIssue, ticketIssueStatus } from "@/server/domain/ticket-issue";
import { env } from "@/server/env";
import { generateQrCodeDataUrl } from "@/server/qr-code";
import { hasAdminSession } from "@/server/security/admin-session";
import { apiFailure } from "@/server/security/request";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasAdminSession())) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  try {
    const { id } = await params;
    const issueId = new URL(request.url).searchParams.get("issueId");
    if (issueId) return Response.json({ status: await ticketIssueStatus(id, z.string().uuid().parse(issueId)) });
    const qr = await getOrCreateQrToken(id);
    const url = `${env().APP_URL}/e/${qr.publicCode}/join?t=${encodeURIComponent(qr.token)}`;
    return Response.json({ image: await generateQrCodeDataUrl(url), expiresIn: qr.expiresIn, serverTime: qr.serverTime });
  } catch (error) { return apiFailure(error); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasAdminSession())) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  try {
    const { allocation } = z.object({ allocation: z.array(z.object({ ticketTypeId: z.string().uuid(), quantity: z.number().int() })) }).parse(await request.json());
    const issue = await createTicketIssue((await params).id, allocation);
    const url = `${env().APP_URL}/e/${issue.publicCode}/join?t=${encodeURIComponent(issue.token)}`;
    return Response.json({ issueId: issue.issueId, image: await generateQrCodeDataUrl(url), expiresIn: issue.expiresIn, serverTime: issue.issuedAt.toISOString(), allocation: issue.allocation });
  } catch (error) { return apiFailure(error); }
}

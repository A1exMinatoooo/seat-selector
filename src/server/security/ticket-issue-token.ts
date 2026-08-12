import "server-only";

import { randomUUID } from "node:crypto";
import { randomToken, tokenHash } from "./crypto";
import { signJson, verifyJson } from "./signed-token";

export const ticketIssueWindowSeconds = 30;
type TicketIssuePayload = { code: string; issueId: string; nonce: string; exp: number };

export function createTicketIssueToken(publicCode: string, now = Date.now()) {
  const issueId = randomUUID();
  const nonce = randomToken(24);
  const expiresAt = now + ticketIssueWindowSeconds * 1000;
  const token = signJson({ code: publicCode, issueId, nonce, exp: expiresAt }, "ticket-issue");
  return { issueId, nonce, token, tokenHash: tokenHash(token), issuedAt: new Date(now), expiresAt: new Date(expiresAt), expiresIn: ticketIssueWindowSeconds };
}

export function verifyTicketIssueToken(publicCode: string, token: string, now = Date.now()): TicketIssuePayload | null {
  const payload = verifyJson<TicketIssuePayload>(token, "ticket-issue");
  if (!payload || payload.code !== publicCode || !payload.issueId || !payload.nonce || !Number.isInteger(payload.exp) || payload.exp <= now) return null;
  return payload;
}

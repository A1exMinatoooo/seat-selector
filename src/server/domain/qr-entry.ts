import "server-only";

import { eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { events } from "@/server/db/schema";
import { tokenHash } from "@/server/security/crypto";
import { createQrToken, verifyQrToken } from "@/server/security/qr-token";
import { DomainError, errorCodes } from "@/shared/errors";

type QrEvent = {
  id: string;
  publicCode: string;
  status: "draft" | "open" | "ended";
  qrTokenNonce: string | null;
  qrTokenHash: string | null;
  qrTokenIssuedAt: Date | null;
  qrTokenExpiresAt: Date | null;
};

type Transaction = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

function currentToken(event: QrEvent, now: number) {
  if (!event.qrTokenNonce || !event.qrTokenHash || !event.qrTokenExpiresAt || event.qrTokenExpiresAt.getTime() <= now) return null;
  const token = createQrToken(event.publicCode, event.qrTokenIssuedAt?.getTime() ?? now, event.qrTokenNonce);
  return { token: token.token, expiresIn: Math.max(1, Math.ceil((event.qrTokenExpiresAt.getTime() - now) / 1000)), serverTime: new Date(now).toISOString(), publicCode: event.publicCode };
}

async function rotate(tx: Transaction, event: QrEvent, now: number) {
  const qr = createQrToken(event.publicCode, now);
  await tx.update(events).set({ qrTokenNonce: qr.nonce, qrTokenHash: qr.tokenHash, qrTokenIssuedAt: qr.issuedAt, qrTokenExpiresAt: qr.expiresAt }).where(eq(events.id, event.id));
  return { token: qr.token, expiresIn: qr.expiresIn, serverTime: qr.issuedAt.toISOString(), publicCode: event.publicCode };
}

async function lockedEvent(tx: Transaction, eventId: string) {
  const [event] = await tx.select({ id: events.id, publicCode: events.publicCode, status: events.status, qrTokenNonce: events.qrTokenNonce, qrTokenHash: events.qrTokenHash, qrTokenIssuedAt: events.qrTokenIssuedAt, qrTokenExpiresAt: events.qrTokenExpiresAt }).from(events).where(eq(events.id, eventId)).limit(1).for("update");
  return event;
}

export async function getOrCreateQrToken(eventId: string, now = Date.now()) {
  return getDb().transaction(async (tx) => {
    const event = await lockedEvent(tx, eventId);
    if (!event || event.status !== "open") throw new DomainError(errorCodes.notFound, "活动不存在或未开放", 404);
    return currentToken(event, now) ?? rotate(tx, event, now);
  });
}

export async function consumeQrToken(eventId: string, publicCode: string, token: string, now = Date.now()) {
  return getDb().transaction(async (tx) => {
    const event = await lockedEvent(tx, eventId);
    const payload = verifyQrToken(publicCode, token, now);
    if (!event || event.status !== "open" || event.publicCode !== publicCode || !payload || payload.nonce !== event.qrTokenNonce || event.qrTokenHash !== tokenHash(token)) {
      throw new DomainError(errorCodes.forbidden, "二维码已失效，请扫描最新二维码", 403);
    }
    return rotate(tx, event, now);
  });
}

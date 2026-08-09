import "server-only";
import { randomToken, tokenHash } from "./crypto";
import { signJson, verifyJson } from "./signed-token";

export const qrWindowSeconds = 30;
type QrPayload = { code: string; nonce: string; exp: number };

export function createQrToken(publicCode: string, now = Date.now(), nonce = randomToken(24)) {
  const expiresAt = now + qrWindowSeconds * 1000;
  const token = signJson({ code: publicCode, nonce, exp: expiresAt }, "qr-entry");
  return { token, nonce, tokenHash: tokenHash(token), issuedAt: new Date(now), expiresAt: new Date(expiresAt), expiresIn: qrWindowSeconds };
}

export function verifyQrToken(publicCode: string, token: string, now = Date.now()): QrPayload | null {
  const payload = verifyJson<QrPayload>(token, "qr-entry");
  if (!payload || payload.code !== publicCode || !payload.nonce || !Number.isInteger(payload.exp) || payload.exp <= now) return null;
  return payload;
}

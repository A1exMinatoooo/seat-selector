import "server-only";
import { signValue, verifyValue } from "./signed-token";

export const qrWindowSeconds = 30;
export function createQrToken(publicCode: string, now = Date.now()) { const bucket = Math.floor(now / 1000 / qrWindowSeconds); return { token: signValue(`${publicCode}:${bucket}`, "qr-entry"), expiresIn: qrWindowSeconds - (Math.floor(now / 1000) % qrWindowSeconds) }; }
export function verifyQrToken(publicCode: string, token: string, now = Date.now()): boolean { const value = verifyValue(token, "qr-entry"); if (!value) return false; const [code, bucketText] = value.split(":"); const bucket = Number(bucketText); const current = Math.floor(now / 1000 / qrWindowSeconds); return code === publicCode && Number.isInteger(bucket) && (bucket === current || bucket === current - 1); }

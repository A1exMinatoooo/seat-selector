import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { deriveKey } from "./crypto";

export function signValue(value: string, purpose: string): string {
  const signature = createHmac("sha256", deriveKey(purpose)).update(value).digest("base64url");
  return `${value}.${signature}`;
}

export function verifyValue(token: string, purpose: string): string | null {
  const separator = token.lastIndexOf(".");
  if (separator < 1) return null;
  const value = token.slice(0, separator);
  const supplied = Buffer.from(token.slice(separator + 1), "base64url");
  const expected = createHmac("sha256", deriveKey(purpose)).update(value).digest();
  return supplied.length === expected.length && timingSafeEqual(supplied, expected) ? value : null;
}

export function signJson(payload: object, purpose: string): string {
  return signValue(Buffer.from(JSON.stringify(payload)).toString("base64url"), purpose);
}

export function verifyJson<T>(token: string, purpose: string): T | null {
  const value = verifyValue(token, purpose);
  if (!value) return null;
  try { return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T; } catch { return null; }
}

import "server-only";
import {
  createHash,
  hkdfSync,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { env } from "@/server/env";

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function deriveKey(purpose: string): Buffer {
  return Buffer.from(hkdfSync("sha256", env().APP_SECRET, "pick-your-seat", purpose, 32));
}

export function hashPassword(password: string, salt = randomBytes(16).toString("base64url")): string {
  const n = 16_384;
  const r = 8;
  const p = 1;
  const hash = scryptSync(password, salt, 32, { N: n, r, p }).toString("base64url");
  return `scrypt$${n}$${r}$${p}$${salt}$${hash}`;
}

export function verifyPassword(password: string, encoded: string): boolean {
  const [scheme, n, r, p, salt, expected] = encoded.split("$");
  if (scheme !== "scrypt" || !n || !r || !p || !salt || !expected) return false;
  const actual = scryptSync(password, salt, 32, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  const target = Buffer.from(expected, "base64url");
  return actual.length === target.length && timingSafeEqual(actual, target);
}

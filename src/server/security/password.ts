import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

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
  const actual = scryptSync(password, salt, 32, { N: Number(n), r: Number(r), p: Number(p) });
  const target = Buffer.from(expected, "base64url");
  return actual.length === target.length && timingSafeEqual(actual, target);
}

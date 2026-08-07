import "server-only";
import {
  createHash,
  hkdfSync,
  randomBytes,
} from "node:crypto";
import { env } from "@/server/env";
export { hashPassword, verifyPassword } from "./password";

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function deriveKey(purpose: string): Buffer {
  return Buffer.from(hkdfSync("sha256", env().APP_SECRET, "pick-your-seat", purpose, 32));
}

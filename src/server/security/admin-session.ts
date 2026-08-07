import "server-only";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminSessions } from "@/server/db/schema";
import { getDb } from "@/server/db/client";
import { randomToken, tokenHash } from "./crypto";

const cookieName = "pickseat_admin";
const sessionDurationMs = 12 * 60 * 60 * 1000;

export async function createAdminSession(): Promise<void> {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + sessionDurationMs);
  await getDb().insert(adminSessions).values({ tokenHash: tokenHash(token), expiresAt });
  const jar = await cookies();
  jar.set(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function hasAdminSession(): Promise<boolean> {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return false;
  const [session] = await getDb()
    .select({ id: adminSessions.id })
    .from(adminSessions)
    .where(and(eq(adminSessions.tokenHash, tokenHash(token)), gt(adminSessions.expiresAt, new Date())))
    .limit(1);
  return Boolean(session);
}

export async function requireAdmin(): Promise<void> {
  if (!(await hasAdminSession())) redirect("/admin/login");
}

export async function clearAdminSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  if (token) await getDb().delete(adminSessions).where(eq(adminSessions.tokenHash, tokenHash(token)));
  jar.delete(cookieName);
}

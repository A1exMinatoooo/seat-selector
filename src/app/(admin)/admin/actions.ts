"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { env } from "@/server/env";
import { clearAdminSession, createAdminSession } from "@/server/security/admin-session";
import { verifyPassword } from "@/server/security/crypto";
import { rateLimit } from "@/server/security/rate-limit";

export async function loginAction(formData: FormData): Promise<void> {
  const headerStore = await headers();
  const address = env().TRUSTED_PROXY_COUNT > 0 ? headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown" : "direct";
  if (!rateLimit(`admin-login:${address}`, 10, 15 * 60_000)) redirect("/admin/login?error=rate");
  const password = formData.get("password");
  if (typeof password !== "string" || !verifyPassword(password, env().ADMIN_PASSWORD_HASH)) {
    redirect("/admin/login?error=1");
  }
  await createAdminSession();
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  await clearAdminSession();
  redirect("/admin/login");
}

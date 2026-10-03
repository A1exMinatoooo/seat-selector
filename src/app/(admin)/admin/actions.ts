"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { adminActionError, type AdminActionState } from "@/features/admin/admin-action-state";
import { env } from "@/server/env";
import { clearAdminSession, createAdminSession } from "@/server/security/admin-session";
import { verifyPassword } from "@/server/security/crypto";
import { rateLimit } from "@/server/security/rate-limit";

export async function loginAction(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const headerStore = await headers();
  const address =
    env().TRUSTED_PROXY_COUNT > 0
      ? (headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown")
      : "direct";
  if (!rateLimit(`admin-login:${address}`, 10, 15 * 60_000)) {
    return adminActionError("尝试次数过多，请稍后再试。", "LOGIN_RATE_LIMITED");
  }
  const password = formData.get("password");
  if (typeof password !== "string" || !verifyPassword(password, env().ADMIN_PASSWORD_HASH)) {
    return adminActionError("口令不正确，请重试。", "INVALID_CREDENTIALS", {
      password: "口令不正确，请重试。",
    });
  }
  await createAdminSession();
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  await clearAdminSession();
  redirect("/admin/login");
}

"use server";

import { redirect } from "next/navigation";
import { env } from "@/server/env";
import { clearAdminSession, createAdminSession } from "@/server/security/admin-session";
import { verifyPassword } from "@/server/security/crypto";

export async function loginAction(formData: FormData): Promise<void> {
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

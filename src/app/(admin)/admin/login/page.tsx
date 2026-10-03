import { redirect } from "next/navigation";
import { AdminActionForm } from "@/features/admin/admin-action-form";
import { AdminSubmitButton } from "@/features/admin/admin-submit-button";
import { hasAdminSession } from "@/server/security/admin-session";
import { loginAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if (await hasAdminSession()) redirect("/admin");
  return (
    <main className="auth-shell">
      <AdminActionForm
        action={loginAction}
        className="auth-card"
        clearFieldsOnError={["password"]}
      >
        <p className="eyebrow">活动管理</p>
        <h1>欢迎回来</h1>
        <p>输入管理员口令继续。</p>
        <label>
          管理员口令
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            minLength={10}
          />
        </label>
        <AdminSubmitButton pendingLabel="登录中…">登录管理端</AdminSubmitButton>
      </AdminActionForm>
    </main>
  );
}

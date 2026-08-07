import { redirect } from "next/navigation";
import { hasAdminSession } from "@/server/security/admin-session";
import { loginAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await hasAdminSession()) redirect("/admin");
  const { error } = await searchParams;
  return (
    <main className="auth-shell">
      <form action={loginAction} className="auth-card">
        <p className="eyebrow">活动管理</p>
        <h1>欢迎回来</h1>
        <p>输入管理员口令继续。</p>
        <label>
          管理员口令
          <input name="password" type="password" autoComplete="current-password" required minLength={10} />
        </label>
        {error ? <p className="form-error" role="alert">{error === "rate" ? "尝试次数过多，请稍后再试。" : "口令不正确，请重试。"}</p> : null}
        <button className="button primary" type="submit">登录管理端</button>
      </form>
    </main>
  );
}

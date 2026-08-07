import { logoutAction } from "./actions";
import { requireAdmin } from "@/server/security/admin-session";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  await requireAdmin();
  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div><p className="eyebrow">银幕座席</p><h1>活动控制台</h1></div>
        <form action={logoutAction}><button className="button" type="submit">退出</button></form>
      </header>
      <section className="empty-state">
        <span>01</span><h2>先建立影厅模板</h2><p>录入影院、座位布局与现场地点后，即可发起第一场选座活动。</p>
      </section>
    </main>
  );
}

import Link from "next/link";
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
      <section className="dashboard-grid">
        <Link className="dashboard-card featured" href="/admin/venues"><span>01</span><h2>影厅模板</h2><p>录入影院、座位布局、中线与黄金观影区。</p></Link>
        <div className="dashboard-card"><span>02</span><h2>活动管理</h2><p>影厅模板就绪后，在这里创建活动。</p></div>
      </section>
    </main>
  );
}

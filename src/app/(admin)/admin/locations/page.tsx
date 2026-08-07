import Link from "next/link";
import { asc } from "drizzle-orm";
import { NumericInput } from "@/features/forms/numeric-input";
import { getDb } from "@/server/db/client";
import { locationPresets } from "@/server/db/schema";
import { requireAdmin } from "@/server/security/admin-session";
import { createLocationAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function LocationsPage() {
  await requireAdmin();
  const locations = await getDb().select().from(locationPresets).orderBy(asc(locationPresets.name));
  return <main className="admin-shell">
    <nav className="crumbs"><Link href="/admin">控制台</Link><span>/</span><strong>地点库</strong></nav>
    <header className="section-header"><div><p className="eyebrow">现场定位</p><h1>活动地点</h1></div><span>{locations.length} 个地点</span></header>
    <div className="admin-grid">
      <section className="panel"><h2>新增地点</h2><form action={createLocationAction} className="stack-form"><label>地点名称<input name="name" required placeholder="例如：上海影城正门" /></label><div className="form-row"><label>纬度<NumericInput name="latitude" step="any" min={-90} max={90} placeholder="31.2304" /></label><label>经度<NumericInput name="longitude" step="any" min={-180} max={180} placeholder="121.4737" /></label></div><label>默认范围（米）<NumericInput name="defaultRadiusMeters" min={50} max={100000} defaultValue={1000} /></label><button className="button primary" type="submit">保存地点</button></form></section>
      <section className="panel"><h2>地点列表</h2>{locations.length ? <ul className="record-list">{locations.map((location) => <li key={location.id}><div><strong>{location.name}</strong><small>{location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</small></div><span>{location.defaultRadiusMeters} m</span></li>)}</ul> : <p className="muted">还没有预录地点。</p>}</section>
    </div>
  </main>;
}

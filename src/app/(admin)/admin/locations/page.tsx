import Link from "next/link";
import { AdminBackButton } from "@/features/admin/admin-back-button";
import { LocationDeleteButton } from "@/features/locations/location-delete-button";
import { LocationPresetCreateForm } from "@/features/locations/location-preset-create-form";
import { listLocationPresets } from "@/server/db/location-presets";
import { requireAdmin } from "@/server/security/admin-session";

export const dynamic = "force-dynamic";

export default async function LocationsPage() {
  await requireAdmin();
  const locations = await listLocationPresets();
  return (
    <main className="admin-shell">
      <AdminBackButton href="/admin" label="控制台" />
      <nav className="crumbs">
        <Link href="/admin">控制台</Link>
        <span>/</span>
        <strong>地点库</strong>
      </nav>
      <header className="section-header">
        <div>
          <p className="eyebrow">现场定位</p>
          <h1>活动地点</h1>
        </div>
        <span>{locations.length} 个地点</span>
      </header>
      <div className="admin-grid">
        <section className="panel">
          <h2>新增地点</h2>
          <LocationPresetCreateForm />
        </section>
        <section className="panel">
          <h2>地点列表</h2>
          {locations.length ? (
            <ul className="record-list actionable-record-list">
              {locations.map((location) => (
                <li key={location.id}>
                  <div>
                    <strong>{location.name}</strong>
                    <small>
                      {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
                    </small>
                  </div>
                  <div className="row-actions">
                    <span>{location.defaultRadiusMeters} m</span>
                    <Link
                      className="button"
                      href={`/admin/locations/${location.id}/edit`}
                      aria-label={`编辑地点 ${location.name}`}
                    >
                      编辑
                    </Link>
                    <LocationDeleteButton id={location.id} label={location.name} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">还没有预录地点。</p>
          )}
        </section>
      </div>
    </main>
  );
}

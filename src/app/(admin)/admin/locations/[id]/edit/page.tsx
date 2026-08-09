import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { LocationPresetEditForm } from "@/features/locations/location-preset-edit-form";
import { AdminBackButton } from "@/features/admin/admin-back-button";
import { findLocationPreset } from "@/server/db/location-presets";
import { requireAdmin } from "@/server/security/admin-session";

export const dynamic = "force-dynamic";

export default async function EditLocationPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const parsedId = z.string().uuid().safeParse((await params).id);
  if (!parsedId.success) notFound();
  const location = await findLocationPreset(parsedId.data);
  if (!location) notFound();
  return <main className="admin-shell">
    <AdminBackButton href="/admin/locations" label="活动地点" />
    <nav className="crumbs"><Link href="/admin/locations">活动地点</Link><span>/</span><strong>编辑</strong></nav>
    <header className="section-header"><div><p className="eyebrow">现场定位</p><h1>编辑地点</h1></div></header>
    <LocationPresetEditForm location={location} />
  </main>;
}

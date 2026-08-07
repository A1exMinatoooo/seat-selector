import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { cinemas, events, halls, locationPresets } from "@/server/db/schema";
import { requireAdmin } from "@/server/security/admin-session";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  await requireAdmin();
  const rows = await getDb().select({ id: events.id, name: events.name, startsAt: events.startsAt, status: events.status, hall: halls.name, cinema: cinemas.name, location: locationPresets.name }).from(events).innerJoin(halls, eq(events.hallId, halls.id)).innerJoin(cinemas, eq(halls.cinemaId, cinemas.id)).innerJoin(locationPresets, eq(events.locationId, locationPresets.id)).orderBy(desc(events.startsAt));
  return <main className="admin-shell"><nav className="crumbs"><Link href="/admin">控制台</Link><span>/</span><strong>活动</strong></nav><header className="section-header"><div><p className="eyebrow">活动编排</p><h1>观影活动</h1></div><Link className="button primary" href="/admin/events/new">新建活动</Link></header><section className="panel">{rows.length ? <ul className="event-list">{rows.map((event) => <li key={event.id}><Link href={`/admin/events/${event.id}`}><div><span className={`status ${event.status}`}>{({ draft: "草稿", open: "开放中", ended: "已结束" } as const)[event.status]}</span><h2>{event.name}</h2><p>{event.cinema} · {event.hall} · {event.location}</p></div><time>{event.startsAt.toLocaleString("zh-CN")}</time></Link></li>)}</ul> : <p className="muted">还没有活动。</p>}</section></main>;
}

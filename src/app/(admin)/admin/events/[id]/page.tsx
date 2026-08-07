import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/server/db/client";
import { cinemas, events, halls, locationPresets, ticketTypes } from "@/server/db/schema";
import { requireAdmin } from "@/server/security/admin-session";
import { setEventStatusAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin(); const { id } = await params;
  const [event] = await getDb().select({ id: events.id, name: events.name, status: events.status, startsAt: events.startsAt, radiusMeters: events.radiusMeters, hall: halls.name, cinema: cinemas.name, location: locationPresets.name }).from(events).innerJoin(halls, eq(events.hallId, halls.id)).innerJoin(cinemas, eq(halls.cinemaId, cinemas.id)).innerJoin(locationPresets, eq(events.locationId, locationPresets.id)).where(eq(events.id, id)).limit(1);
  if (!event) notFound();
  const types = await getDb().select().from(ticketTypes).where(eq(ticketTypes.eventId, id)).orderBy(asc(ticketTypes.sortOrder));
  return <main className="admin-shell"><nav className="crumbs"><Link href="/admin/events">活动</Link><span>/</span><strong>{event.name}</strong></nav><header className="section-header"><div><p className="eyebrow">{event.status === "draft" ? "草稿" : event.status === "open" ? "开放中" : "已结束"}</p><h1>{event.name}</h1></div><div className="header-actions"><Link className="button" href={`/admin/events/${event.id}/participants`}>参与者清单</Link>{event.status === "open" ? <Link className="button" href={`/admin/events/${event.id}/checkin`}>现场二维码</Link> : null}{event.status !== "ended" ? <form action={setEventStatusAction}><input type="hidden" name="id" value={event.id} /><input type="hidden" name="status" value={event.status === "draft" ? "open" : "ended"} /><button className="button primary" type="submit">{event.status === "draft" ? "开放选座" : "结束活动"}</button></form> : null}</div></header><div className="admin-grid"><section className="panel"><h2>活动信息</h2><dl className="details"><dt>影院影厅</dt><dd>{event.cinema} · {event.hall}</dd><dt>地点范围</dt><dd>{event.location} · {event.radiusMeters}m</dd><dt>开始时间</dt><dd>{event.startsAt.toLocaleString("zh-CN")}</dd></dl></section><section className="panel"><h2>票种</h2><ul className="record-list">{types.map((type) => <li key={type.id}><strong>{type.name}</strong><span>排序 {type.sortOrder + 1}</span></li>)}</ul></section></div></main>;
}

import Link from "next/link";
import { asc, eq, isNull } from "drizzle-orm";
import { TicketTypeFields } from "@/features/events/ticket-type-fields";
import { EventSeatEditor } from "@/features/events/event-seat-editor";
import { NumericInput } from "@/features/forms/numeric-input";
import { getDb } from "@/server/db/client";
import { cinemas, halls, locationPresets, seats } from "@/server/db/schema";
import { requireAdmin } from "@/server/security/admin-session";
import { supportedTimeZones } from "@/shared/date-time";
import { createEventAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewEventPage() {
  await requireAdmin();
  const [hallRows, locations, seatRows] = await Promise.all([
    getDb().select({ id: halls.id, hall: halls.name, cinema: cinemas.name }).from(halls).innerJoin(cinemas, eq(halls.cinemaId, cinemas.id)).where(isNull(halls.archivedAt)).orderBy(asc(cinemas.name), asc(halls.name)),
    getDb().select().from(locationPresets).orderBy(asc(locationPresets.name)),
    getDb().select().from(seats).orderBy(asc(seats.rowIndex), asc(seats.columnIndex)),
  ]);
  const layouts = hallRows.map((hall) => ({ id: hall.id, name: `${hall.cinema} · ${hall.hall}`, seats: seatRows.filter((seat) => seat.hallId === hall.id) }));
  const timeZones = supportedTimeZones();
  return <main className="admin-shell"><nav className="crumbs"><Link href="/admin/events">活动</Link><span>/</span><strong>新建</strong></nav><header className="section-header"><div><p className="eyebrow">新活动</p><h1>建立选座活动</h1></div></header>{hallRows.length && locations.length ? <form action={createEventAction} className="panel stack-form"><div className="form-row"><label>活动名称<input name="name" required placeholder="例如：八月特别观影会" /></label><label>显示时区<select name="timeZone" defaultValue="Asia/Shanghai">{timeZones.map((timeZone) => <option key={timeZone} value={timeZone}>{timeZone}</option>)}</select></label></div><div className="form-row"><label>开始日期<input name="startDate" type="date" required /></label><label>开始时间<input name="startTime" type="time" step={60} required /></label></div><div className="form-row"><label>活动地点<select name="locationId">{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label><label>定位半径（米）<NumericInput name="radiusMeters" min={50} max={100000} defaultValue={1000} /></label></div><EventSeatEditor halls={layouts} initialHallId={hallRows[0]!.id} includeHallSelect /><TicketTypeFields /><button className="button primary" type="submit">保存草稿</button></form> : <section className="panel"><p>请先建立至少一个影厅模板和活动地点。</p></section>}</main>;
}

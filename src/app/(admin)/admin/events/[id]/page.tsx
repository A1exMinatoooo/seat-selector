import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { EventSeatManagementForm } from "@/features/events/event-seat-management-form";
import { EventStatusForm } from "@/features/events/event-status-form";
import { getDb } from "@/server/db/client";
import { cinemas, eventSeats, events, halls, locationPresets, lotteryPrizes, reservationSeats, seats, ticketTypes } from "@/server/db/schema";
import { requireAdmin } from "@/server/security/admin-session";

export const dynamic = "force-dynamic";

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const [event] = await getDb().select({ id: events.id, name: events.name, hallId: events.hallId, status: events.status, version: events.version, startsAt: events.startsAt, radiusMeters: events.radiusMeters, lotteryEnabled: events.lotteryEnabled, centerAfterColumn: halls.centerAfterColumn, hall: halls.name, cinema: cinemas.name, location: locationPresets.name }).from(events).innerJoin(halls, eq(events.hallId, halls.id)).innerJoin(cinemas, eq(halls.cinemaId, cinemas.id)).innerJoin(locationPresets, eq(events.locationId, locationPresets.id)).where(eq(events.id, id)).limit(1);
  if (!event) notFound();
  const [types, prizes, hallSeatRows, availableRows, reservedRows] = await Promise.all([getDb().select().from(ticketTypes).where(eq(ticketTypes.eventId, id)).orderBy(asc(ticketTypes.sortOrder)), getDb().select().from(lotteryPrizes).where(eq(lotteryPrizes.eventId, id)).orderBy(asc(lotteryPrizes.sortOrder)), getDb().select().from(seats).where(eq(seats.hallId, event.hallId)).orderBy(asc(seats.rowIndex), asc(seats.columnIndex)), getDb().select({ seatId: eventSeats.seatId }).from(eventSeats).where(eq(eventSeats.eventId, id)), getDb().select({ seatId: reservationSeats.seatId }).from(reservationSeats).where(eq(reservationSeats.eventId, id))]);
  return (
    <main className="admin-shell">
      <nav className="crumbs"><Link href="/admin/events">活动</Link><span>/</span><strong>{event.name}</strong></nav>
      <header className="section-header">
        <div><p className="eyebrow">{event.status === "draft" ? "草稿" : event.status === "open" ? "开放中" : "已结束"}</p><h1>{event.name}</h1></div>
        <div className="header-actions">
          <Link className="button" href={`/admin/events/${event.id}/participants`}>参与者清单</Link>
          <Link className="button" href={`/admin/events/${event.id}/audit`}>审计日志</Link>
          {event.status === "open" ? <Link className="button" href={`/admin/events/${event.id}/checkin`}>现场二维码</Link> : null}
          {event.status !== "ended" ? <EventStatusForm eventId={event.id} status={event.status} /> : null}
        </div>
      </header>
      <div className="admin-grid">
        <section className="panel"><h2>活动信息</h2><dl className="details"><dt>影院影厅</dt><dd>{event.cinema} · {event.hall}</dd><dt>地点范围</dt><dd>{event.location} · {event.radiusMeters}m</dd><dt>开始时间</dt><dd>{event.startsAt.toLocaleString("zh-CN")}</dd><dt>抽奖</dt><dd>{event.lotteryEnabled ? "有" : "无"}</dd></dl></section>
        <section className="panel"><h2>票种</h2><ul className="record-list">{types.map((type) => <li key={type.id}><strong>{type.name}</strong><span>{type.lotteryEligible ? "参与抽奖" : "不参与抽奖"}</span></li>)}</ul></section>
        {event.lotteryEnabled ? <section className="panel"><h2>奖品清单</h2><ul className="record-list">{prizes.map((prize) => <li key={prize.id}><strong>{prize.name}</strong><span>数量 {prize.quantity}</span></li>)}</ul><p className="muted">未中奖由系统按总抽奖次数自动补足。</p></section> : null}
      </div>
      {event.status !== "ended" ? <EventSeatManagementForm eventId={event.id} version={event.version} hall={{ id: event.hallId, name: `${event.cinema} · ${event.hall}`, seats: hallSeatRows }} initialAvailableSeatIds={availableRows.map((item) => item.seatId)} lockedSeatIds={reservedRows.map((item) => item.seatId)} centerAfterColumn={event.centerAfterColumn} enableHalfLockControls={event.status === "open"} /> : null}
    </main>
  );
}

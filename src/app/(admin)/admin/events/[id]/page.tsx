import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { EventSeatManagementForm } from "@/features/events/event-seat-management-form";
import { AdminBackButton } from "@/features/admin/admin-back-button";
import { EventStatusForm } from "@/features/events/event-status-form";
import { TicketTypeFields } from "@/features/events/ticket-type-fields";
import { NumericInput } from "@/features/forms/numeric-input";
import { SearchableSelectField, SelectField } from "@/features/forms/select-field";
import { DatePickerField } from "@/features/forms/date-picker-field";
import { TimePickerField } from "@/features/forms/time-picker-field";
import { getDb } from "@/server/db/client";
import {
  cinemas,
  eventSeats,
  events,
  halls,
  locationPresets,
  lotteryPrizes,
  reservationSeats,
  seats,
  ticketTypes,
} from "@/server/db/schema";
import { requireAdmin } from "@/server/security/admin-session";
import { formatLocalDateTime, supportedTimeZones } from "@/shared/date-time";
import { updateEventConfigurationAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const [event] = await getDb()
    .select({
      id: events.id,
      name: events.name,
      hallId: events.hallId,
      locationId: events.locationId,
      status: events.status,
      version: events.version,
      startsAt: events.startsAt,
      timeZone: events.timeZone,
      radiusMeters: events.radiusMeters,
      locationCheckEnabled: events.locationCheckEnabled,
      lotteryEnabled: events.lotteryEnabled,
      lotteryPoolBonus: events.lotteryPoolBonus,
      participationMode: events.participationMode,
      maxTicketsPerIssue: events.maxTicketsPerIssue,
      expectedLotteryTickets: events.expectedLotteryTickets,
      lockedSeatHalf: events.lockedSeatHalf,
      centerAfterColumn: halls.centerAfterColumn,
      cinemaId: cinemas.id,
      hall: halls.name,
      cinema: cinemas.name,
      location: locationPresets.name,
    })
    .from(events)
    .innerJoin(halls, eq(events.hallId, halls.id))
    .innerJoin(cinemas, eq(halls.cinemaId, cinemas.id))
    .innerJoin(locationPresets, eq(events.locationId, locationPresets.id))
    .where(eq(events.id, id))
    .limit(1);
  if (!event) notFound();
  const [types, prizes, hallSeatRows, availableRows, reservedRows, locations] = await Promise.all([
    getDb()
      .select()
      .from(ticketTypes)
      .where(eq(ticketTypes.eventId, id))
      .orderBy(asc(ticketTypes.sortOrder)),
    getDb()
      .select()
      .from(lotteryPrizes)
      .where(eq(lotteryPrizes.eventId, id))
      .orderBy(asc(lotteryPrizes.sortOrder)),
    getDb()
      .select()
      .from(seats)
      .where(eq(seats.hallId, event.hallId))
      .orderBy(asc(seats.rowIndex), asc(seats.columnIndex)),
    getDb()
      .select({ seatId: eventSeats.seatId })
      .from(eventSeats)
      .where(eq(eventSeats.eventId, id)),
    getDb()
      .select({ seatId: reservationSeats.seatId })
      .from(reservationSeats)
      .where(eq(reservationSeats.eventId, id)),
    getDb().select().from(locationPresets).orderBy(asc(locationPresets.name)),
  ]);
  const localStart = formatLocalDateTime(event.startsAt, event.timeZone);
  return (
    <main className="admin-shell">
      <AdminBackButton href="/admin/events" label="活动" />
      <nav className="crumbs">
        <Link href="/admin/events">活动</Link>
        <span>/</span>
        <strong>{event.name}</strong>
      </nav>
      <header className="section-header">
        <div>
          <p className="eyebrow">
            {event.status === "draft" ? "草稿" : event.status === "open" ? "开放中" : "已结束"}
          </p>
          <h1>{event.name}</h1>
        </div>
        <div className="header-actions">
          <Link className="button" href={`/admin/events/${event.id}/participants`}>
            {event.participationMode === "onsite" ? "发行记录" : "参与者清单"}
          </Link>
          <Link className="button" href={`/admin/events/${event.id}/audit`}>
            审计日志
          </Link>
          {event.status === "open" ? (
            <Link className="button" href={`/admin/events/${event.id}/checkin`}>
              现场二维码
            </Link>
          ) : null}
          <EventStatusForm eventId={event.id} status={event.status} />
        </div>
      </header>
      {event.status === "draft" ? (
        <form action={updateEventConfigurationAction} className="panel wide stack-form">
          <h2>编辑活动设置</h2>
          <input type="hidden" name="id" value={event.id} />
          <div className="form-row">
            <label>
              活动名称
              <input name="name" defaultValue={event.name} required />
            </label>
            <SearchableSelectField
              name="timeZone"
              label="显示时区"
              defaultValue={event.timeZone}
              options={supportedTimeZones().map((timeZone) => ({ id: timeZone, label: timeZone }))}
              required
            />
          </div>
          <div className="form-row">
            <DatePickerField
              name="startDate"
              label="开始日期"
              defaultValue={localStart.date}
              required
            />
            <TimePickerField
              name="startTime"
              label="开始时间"
              defaultValue={localStart.time}
              required
            />
          </div>
          <div className="form-row">
            <SelectField
              name="locationId"
              label="活动地点"
              defaultValue={event.locationId}
              options={locations.map((location) => ({ id: location.id, label: location.name }))}
              required
            />
            <label>
              定位半径（米）
              <NumericInput
                name="radiusMeters"
                min={50}
                max={100000}
                defaultValue={event.radiusMeters}
              />
            </label>
          </div>
          <label className="switch-label">
            <input
              name="locationCheckEnabled"
              type="checkbox"
              defaultChecked={event.locationCheckEnabled}
            />
            <span className="switch-control" aria-hidden="true" />
            <span>开启活动定位检查</span>
          </label>
          <TicketTypeFields
            initialTypes={types.map((type) => ({
              id: type.id,
              name: type.name,
              lotteryEligible: type.lotteryEligible,
            }))}
            initialLotteryEnabled={event.lotteryEnabled}
            initialLotteryPoolBonus={event.lotteryPoolBonus}
            initialPrizes={prizes.map((prize) => ({ name: prize.name, quantity: prize.quantity }))}
            initialParticipationMode={event.participationMode}
            initialMaxTicketsPerIssue={event.maxTicketsPerIssue}
            initialExpectedLotteryTickets={event.expectedLotteryTickets}
          />
          <button className="button primary" type="submit">
            保存活动设置
          </button>
        </form>
      ) : (
        <div className="admin-grid">
          <section className="panel">
            <h2>活动信息</h2>
            <dl className="details">
              <dt>影院影厅</dt>
              <dd>
                {event.cinema} · {event.hall}
              </dd>
              <dt>地点范围</dt>
              <dd>
                {event.location} · {event.radiusMeters}m
              </dd>
              <dt>定位检查</dt>
              <dd>{event.locationCheckEnabled ? "开启" : "关闭"}</dd>
              <dt>开始时间</dt>
              <dd>{event.startsAt.toLocaleString("zh-CN", { timeZone: event.timeZone })}</dd>
              <dt>显示时区</dt>
              <dd>{event.timeZone}</dd>
              <dt>参与方式</dt>
              <dd>
                {event.participationMode === "onsite"
                  ? `现场发行（单次最多 ${event.maxTicketsPerIssue} 张）`
                  : "预录参与者"}
              </dd>
              <dt>抽奖</dt>
              <dd>
                {event.lotteryEnabled
                  ? `有${event.participationMode === "onsite" ? ` · 预计可抽奖票数 ${event.expectedLotteryTickets}` : ""}`
                  : "无"}
              </dd>
            </dl>
          </section>
          <section className="panel">
            <h2>票种</h2>
            <ul className="record-list">
              {types.map((type) => (
                <li key={type.id}>
                  <strong>{type.name}</strong>
                  <span>{type.lotteryEligible ? "参与抽奖" : "不参与抽奖"}</span>
                </li>
              ))}
            </ul>
          </section>
          {event.lotteryEnabled ? (
            <section className="panel">
              <h2>奖品清单</h2>
              <ul className="record-list">
                {prizes.map((prize) => (
                  <li key={prize.id}>
                    <strong>{prize.name}</strong>
                    <span>数量 {prize.quantity}</span>
                  </li>
                ))}
              </ul>
              <p className="muted">
                未中奖由系统按总抽奖次数自动补足；额外奖池人数 {event.lotteryPoolBonus}。
              </p>
            </section>
          ) : null}
        </div>
      )}
      {event.status !== "ended" ? (
        <EventSeatManagementForm
          eventId={event.id}
          version={event.version}
          hall={{
            id: event.hallId,
            cinemaId: event.cinemaId,
            cinemaName: event.cinema,
            hallName: event.hall,
            seats: hallSeatRows,
          }}
          initialAvailableSeatIds={availableRows.map((item) => item.seatId)}
          lockedSeatIds={reservedRows.map((item) => item.seatId)}
          initialLockedSeatHalf={event.lockedSeatHalf}
          centerAfterColumn={event.centerAfterColumn}
          enableHalfLockControls={event.status === "open"}
          planningToolsEnabled={event.status === "draft"}
        />
      ) : null}
    </main>
  );
}

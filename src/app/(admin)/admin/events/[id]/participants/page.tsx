import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { NumericInput } from "@/features/forms/numeric-input";
import { getDb } from "@/server/db/client";
import { events, participants, participantTickets, reservations, reservationSeats, seats, ticketTypes } from "@/server/db/schema";
import { requireAdmin } from "@/server/security/admin-session";
import { formatDateTimeMilliseconds } from "@/shared/date-time";
import { maskPhone } from "@/shared/phone";
import { addParticipantAction, importParticipantsAction, resetDeviceAction, resetSelectionAction, toggleLocationExemptionAction } from "./actions";

export const dynamic = "force-dynamic";

function confirmationTime(value: Date | undefined, timeZone: string): string {
  return value ? formatDateTimeMilliseconds(value, timeZone) : "—";
}

export default async function ParticipantsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const [event] = await getDb().select().from(events).where(eq(events.id, id)).limit(1);
  if (!event) notFound();
  const [people, allocations, types, reservationRows, seatRows] = await Promise.all([
    getDb().select().from(participants).where(eq(participants.eventId, id)).orderBy(asc(participants.createdAt)),
    getDb().select({ participantId: participantTickets.participantId, name: ticketTypes.name, quantity: participantTickets.quantity }).from(participantTickets).innerJoin(ticketTypes, eq(participantTickets.ticketTypeId, ticketTypes.id)).where(eq(ticketTypes.eventId, id)),
    getDb().select().from(ticketTypes).where(eq(ticketTypes.eventId, id)).orderBy(asc(ticketTypes.sortOrder)),
    getDb().select().from(reservations).where(eq(reservations.eventId, id)),
    getDb().select({ participantId: reservations.participantId, rowLabel: seats.rowLabel, columnLabel: seats.columnLabel }).from(reservationSeats).innerJoin(reservations, eq(reservationSeats.reservationId, reservations.id)).innerJoin(seats, eq(reservationSeats.seatId, seats.id)).where(eq(reservationSeats.eventId, id)),
  ]);
  const byPerson = Map.groupBy(allocations, (allocation) => allocation.participantId);
  const reservationMap = new Map(reservationRows.map((row) => [row.participantId, row]));
  const seatMap = Map.groupBy(seatRows, (row) => row.participantId);
  const editable = event.status !== "ended";

  return (
    <main className="admin-shell">
      <nav className="crumbs"><Link href={`/admin/events/${id}`}>{event.name}</Link><span>/</span><strong>参与者</strong></nav>
      <header className="section-header">
        <div><p className="eyebrow">参与清单</p><h1>{people.length} 位参与者</h1></div>
        <a className="button" href={`/api/admin/events/${id}/export.csv`}>导出选座记录</a>
      </header>

      <div className="admin-grid participant-entry-grid">
        <section className="panel">
          <h2>CSV 批量导入</h2>
          <p className="muted">模板会按当前票种生成列：姓名、手机号或尾号、{types.map((type) => `${type.name}${type.lotteryEligible ? "（参与抽奖）" : ""}`).join("、")}。</p>
          <div className="header-actions">
            <a className="button" href={`/api/admin/events/${id}/participants/template.csv`}>下载导入模板</a>
          </div>
          {editable ? (
            <form action={importParticipantsAction} className="stack-form participant-import-form">
              <input type="hidden" name="eventId" value={id} />
              <label>选择填写后的 CSV 文件<input type="file" name="csv" accept=".csv,text/csv" required /></label>
              <button className="button primary" type="submit">导入参与者</button>
            </form>
          ) : <p className="muted">活动已结束，不能继续导入。</p>}
        </section>

        <section className="panel">
          <h2>手动增加参与者</h2>
          <p className="muted">适合临时补录单个参与者；手机号可填写完整号码或四位尾号。</p>
          {editable ? (
            <form action={addParticipantAction} className="stack-form">
              <input type="hidden" name="eventId" value={id} />
              <div className="form-row">
                <label>姓名<input name="name" maxLength={80} autoComplete="off" required /></label>
                <label>手机号或四位尾号<input name="phone" inputMode="tel" maxLength={20} autoComplete="off" required /></label>
              </div>
              <fieldset className="ticket-allocation">
                <legend>购买票种与张数</legend>
                <div className="form-row">
                  {types.map((type) => <label key={type.id}>{type.name}{type.lotteryEligible ? "（参与抽奖）" : ""}<NumericInput name={`ticket:${type.id}`} min={0} max={20} defaultValue={0} /></label>)}
                </div>
                <small>所有票种合计至少 1 张，单个票种最多 20 张。</small>
              </fieldset>
              <button className="button primary" type="submit">增加参与者</button>
            </form>
          ) : <p className="muted">活动已结束，不能继续增加参与者。</p>}
        </section>
      </div>

      <section className="panel wide">
        <h2>参与者</h2>
        {people.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>姓名</th><th>手机</th><th>票种</th><th>座位</th><th>选座确认时间</th><th>设备</th><th>管理操作</th></tr></thead>
              <tbody>{people.map((person) => (
                <tr key={person.id}>
                  <td>{person.name}</td>
                  <td>{maskPhone(person.phoneDigits, person.phoneIsFull)}</td>
                  <td>{(byPerson.get(person.id) ?? []).map((ticket) => `${ticket.name} × ${ticket.quantity}`).join("、")}</td>
                  <td>{(seatMap.get(person.id) ?? []).map((seat) => `${seat.rowLabel}${seat.columnLabel}`).join("、") || "未选"}</td>
                  <td>{confirmationTime(reservationMap.get(person.id)?.confirmedAt, event.timeZone)}</td>
                  <td>{person.deviceBoundAt ? "已绑定" : "未绑定"}</td>
                  <td><div className="row-actions">
                    {person.deviceBoundAt ? <form action={resetDeviceAction}><input type="hidden" name="eventId" value={id} /><input type="hidden" name="participantId" value={person.id} /><button className="text-button" type="submit">解绑设备</button></form> : null}
                    <form action={toggleLocationExemptionAction}><input type="hidden" name="eventId" value={id} /><input type="hidden" name="participantId" value={person.id} /><input type="hidden" name="enabled" value={person.locationExemptAt ? "0" : "1"} /><button className="text-button" type="submit">{person.locationExemptAt ? "取消定位豁免" : "定位豁免"}</button></form>
                    {reservationMap.has(person.id) ? <form action={resetSelectionAction}><input type="hidden" name="eventId" value={id} /><input type="hidden" name="participantId" value={person.id} /><button className="text-button danger" type="submit">清除选座</button></form> : null}
                  </div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <p className="muted">尚未添加参与者，可使用上方模板批量导入或手动增加。</p>}
      </section>
    </main>
  );
}

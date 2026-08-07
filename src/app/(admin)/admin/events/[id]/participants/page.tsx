import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/server/db/client";
import { events, participants, participantTickets, reservations, reservationSeats, seats, ticketTypes } from "@/server/db/schema";
import { requireAdmin } from "@/server/security/admin-session";
import { importParticipantsAction, resetDeviceAction, resetSelectionAction, toggleLocationExemptionAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function ParticipantsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin(); const { id } = await params;
  const [event] = await getDb().select().from(events).where(eq(events.id, id)).limit(1); if (!event) notFound();
  const [people, allocations, types, reservationRows, seatRows] = await Promise.all([
    getDb().select().from(participants).where(eq(participants.eventId, id)).orderBy(asc(participants.createdAt)),
    getDb().select({ participantId: participantTickets.participantId, name: ticketTypes.name, quantity: participantTickets.quantity }).from(participantTickets).innerJoin(ticketTypes, eq(participantTickets.ticketTypeId, ticketTypes.id)).where(eq(ticketTypes.eventId, id)),
    getDb().select().from(ticketTypes).where(eq(ticketTypes.eventId, id)).orderBy(asc(ticketTypes.sortOrder)),
    getDb().select().from(reservations).where(eq(reservations.eventId, id)),
    getDb().select({ participantId: reservations.participantId, rowLabel: seats.rowLabel, columnLabel: seats.columnLabel }).from(reservationSeats).innerJoin(reservations, eq(reservationSeats.reservationId, reservations.id)).innerJoin(seats, eq(reservationSeats.seatId, seats.id)).where(eq(reservationSeats.eventId, id)),
  ]);
  const byPerson = Map.groupBy(allocations, (allocation) => allocation.participantId);
  const reservationMap = new Map(reservationRows.map((row) => [row.participantId, row])); const seatMap = Map.groupBy(seatRows, (row) => row.participantId);
  return <main className="admin-shell"><nav className="crumbs"><Link href={`/admin/events/${id}`}>{event.name}</Link><span>/</span><strong>参与者</strong></nav><header className="section-header"><div><p className="eyebrow">参与清单</p><h1>{people.length} 位参与者</h1></div><a className="button" href={`/api/admin/events/${id}/export.csv`}>导出 CSV</a></header><section className="panel"><h2>CSV 批量导入</h2><p className="muted">表头：姓名、手机号或尾号、{types.map((type) => type.name).join("、")}。每个票种列填写购买张数。</p><form action={importParticipantsAction} className="inline-form"><input type="hidden" name="eventId" value={id} /><input type="file" name="csv" accept=".csv,text/csv" required /><button className="button primary" type="submit">导入清单</button></form></section><section className="panel wide"><h2>参与者</h2>{people.length ? <div className="table-wrap"><table><thead><tr><th>姓名</th><th>手机</th><th>票种</th><th>座位</th><th>设备</th><th>管理操作</th></tr></thead><tbody>{people.map((person) => <tr key={person.id}><td>{person.name}</td><td>{person.phoneIsFull ? `${person.phoneDigits.slice(0, 3)}****${person.phoneLast4}` : `****${person.phoneLast4}`}</td><td>{(byPerson.get(person.id) ?? []).map((ticket) => `${ticket.name} × ${ticket.quantity}`).join("、")}</td><td>{(seatMap.get(person.id) ?? []).map((seat) => `${seat.rowLabel}${seat.columnLabel}`).join("、") || "未选"}</td><td>{person.deviceBoundAt ? "已绑定" : "未绑定"}</td><td><div className="row-actions">{person.deviceBoundAt ? <form action={resetDeviceAction}><input type="hidden" name="eventId" value={id} /><input type="hidden" name="participantId" value={person.id} /><button className="text-button" type="submit">解绑设备</button></form> : null}<form action={toggleLocationExemptionAction}><input type="hidden" name="eventId" value={id} /><input type="hidden" name="participantId" value={person.id} /><input type="hidden" name="enabled" value={person.locationExemptAt ? "0" : "1"} /><button className="text-button" type="submit">{person.locationExemptAt ? "取消定位豁免" : "定位豁免"}</button></form>{reservationMap.has(person.id) ? <form action={resetSelectionAction}><input type="hidden" name="eventId" value={id} /><input type="hidden" name="participantId" value={person.id} /><button className="text-button danger" type="submit">清除选座</button></form> : null}</div></td></tr>)}</tbody></table></div> : <p className="muted">尚未导入参与者。</p>}</section></main>;
}

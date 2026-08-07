import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/server/db/client";
import { events, participants, participantTickets, ticketTypes } from "@/server/db/schema";
import { requireAdmin } from "@/server/security/admin-session";
import { importParticipantsAction, resetDeviceAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function ParticipantsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin(); const { id } = await params;
  const [event] = await getDb().select().from(events).where(eq(events.id, id)).limit(1); if (!event) notFound();
  const [people, allocations, types] = await Promise.all([
    getDb().select().from(participants).where(eq(participants.eventId, id)).orderBy(asc(participants.createdAt)),
    getDb().select({ participantId: participantTickets.participantId, name: ticketTypes.name, quantity: participantTickets.quantity }).from(participantTickets).innerJoin(ticketTypes, eq(participantTickets.ticketTypeId, ticketTypes.id)).where(eq(ticketTypes.eventId, id)),
    getDb().select().from(ticketTypes).where(eq(ticketTypes.eventId, id)).orderBy(asc(ticketTypes.sortOrder)),
  ]);
  const byPerson = Map.groupBy(allocations, (allocation) => allocation.participantId);
  return <main className="admin-shell"><nav className="crumbs"><Link href={`/admin/events/${id}`}>{event.name}</Link><span>/</span><strong>参与者</strong></nav><header className="section-header"><div><p className="eyebrow">参与清单</p><h1>{people.length} 位参与者</h1></div></header><section className="panel"><h2>CSV 批量导入</h2><p className="muted">表头：姓名、手机号或尾号、{types.map((type) => type.name).join("、")}。每个票种列填写购买张数。</p><form action={importParticipantsAction} className="inline-form"><input type="hidden" name="eventId" value={id} /><input type="file" name="csv" accept=".csv,text/csv" required /><button className="button primary" type="submit">导入清单</button></form></section><section className="panel wide"><h2>参与者</h2>{people.length ? <div className="table-wrap"><table><thead><tr><th>姓名</th><th>手机</th><th>票种</th><th>设备</th><th>操作</th></tr></thead><tbody>{people.map((person) => <tr key={person.id}><td>{person.name}</td><td>{person.phoneIsFull ? `${person.phoneDigits.slice(0, 3)}****${person.phoneLast4}` : `****${person.phoneLast4}`}</td><td>{(byPerson.get(person.id) ?? []).map((ticket) => `${ticket.name} × ${ticket.quantity}`).join("、")}</td><td>{person.deviceBoundAt ? "已绑定" : "未绑定"}</td><td>{person.deviceBoundAt ? <form action={resetDeviceAction}><input type="hidden" name="eventId" value={id} /><input type="hidden" name="participantId" value={person.id} /><button className="text-button" type="submit">解除绑定</button></form> : "—"}</td></tr>)}</tbody></table></div> : <p className="muted">尚未导入参与者。</p>}</section></main>;
}

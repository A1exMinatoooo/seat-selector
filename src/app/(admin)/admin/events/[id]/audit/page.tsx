import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/server/db/client";
import { eventAuditLogs, events, participants } from "@/server/db/schema";
import type { AuditAction } from "@/server/domain/event-audit";
import { requireAdmin } from "@/server/security/admin-session";
import { formatDateTimeMilliseconds } from "@/shared/date-time";

export const dynamic = "force-dynamic";

const actionLabels: Record<AuditAction, string> = {
  event_created: "创建活动",
  event_status_changed: "活动状态变更",
  participants_imported: "批量导入参与者",
  participant_added: "手动增加参与者",
  device_reset: "解绑设备",
  location_exemption_changed: "定位豁免变更",
  selection_reset: "清除选座",
  seat_confirmed: "选座成功",
  seat_conflict: "选座冲突",
};

const statusLabels: Record<string, string> = { draft: "草稿", open: "开放中", ended: "已结束" };

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function conflictReason(value: unknown): string {
  if (value === "reservation_seats_event_seat_uidx") return "座位已被其他参与者确认";
  if (value === "reservations_event_participant_uidx") return "参与者已完成选座";
  if (value === "serialization_failure") return "并发事务重试失败";
  return "选座唯一约束冲突";
}

function auditDetails(action: AuditAction, details: Record<string, unknown>): string {
  if (action === "event_created") return `配置 ${String(details.ticketTypeCount ?? 0)} 个票种`;
  if (action === "event_status_changed") return `${statusLabels[String(details.from)] ?? String(details.from)} → ${statusLabels[String(details.to)] ?? String(details.to)}`;
  if (action === "participants_imported") return `导入 ${String(details.count ?? 0)} 人，共 ${String(details.ticketTotal ?? 0)} 张票`;
  if (action === "participant_added") return `购买 ${String(details.ticketTotal ?? 0)} 张票`;
  if (action === "device_reset") return "管理员解除设备绑定";
  if (action === "location_exemption_changed") return details.enabled === true ? "启用定位豁免" : "取消定位豁免";
  if (action === "selection_reset") return "管理员清除已确认座位";
  if (action === "seat_confirmed") return `确认座位：${stringList(details.seats).join("、") || "未知"}`;
  return `${conflictReason(details.reason)}；请求座位：${stringList(details.requestedSeats).join("、") || "未知"}`;
}

export default async function EventAuditPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const [event] = await getDb().select({ name: events.name, timeZone: events.timeZone }).from(events).where(eq(events.id, id)).limit(1);
  if (!event) notFound();
  const logs = await getDb()
    .select({ id: eventAuditLogs.id, action: eventAuditLogs.action, details: eventAuditLogs.details, occurredAt: eventAuditLogs.occurredAt, participantName: participants.name })
    .from(eventAuditLogs)
    .leftJoin(participants, eq(eventAuditLogs.participantId, participants.id))
    .where(eq(eventAuditLogs.eventId, id))
    .orderBy(desc(eventAuditLogs.occurredAt), desc(eventAuditLogs.id))
    .limit(500);

  return (
    <main className="admin-shell">
      <nav className="crumbs"><Link href={`/admin/events/${id}`}>{event.name}</Link><span>/</span><strong>审计日志</strong></nav>
      <header className="section-header"><div><p className="eyebrow">活动审计</p><h1>审计日志</h1></div><span>最近 {logs.length} 条 · 时间精确到毫秒</span></header>
      <section className="panel wide">
        {logs.length ? (
          <div className="table-wrap"><table><thead><tr><th>发生时间</th><th>事件</th><th>参与者</th><th>详情</th></tr></thead><tbody>{logs.map((log) => <tr key={log.id}><td className="timestamp-cell">{formatDateTimeMilliseconds(log.occurredAt, event.timeZone)}</td><td><span className={`audit-action ${log.action === "seat_conflict" ? "conflict" : ""}`}>{actionLabels[log.action]}</span></td><td>{log.participantName ?? "管理员"}</td><td>{auditDetails(log.action, log.details)}</td></tr>)}</tbody></table></div>
        ) : <p className="muted">该活动暂时没有审计记录。新产生的活动变更、选座和冲突会显示在这里。</p>}
      </section>
    </main>
  );
}

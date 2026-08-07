import Link from "next/link";
import { asc, and, eq, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";
import { HallTemplateEditForm } from "@/features/venues/hall-template-edit-form";
import { getDb } from "@/server/db/client";
import { cinemas, events, halls, seats } from "@/server/db/schema";
import { canEditHallTemplate } from "@/server/domain/hall-template-edit";
import { requireAdmin } from "@/server/security/admin-session";

export const dynamic = "force-dynamic";

export default async function EditHallTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const [hall] = await getDb().select({ id: halls.id, name: halls.name, cinemaName: cinemas.name, centerAfterColumn: halls.centerAfterColumn }).from(halls).innerJoin(cinemas, eq(halls.cinemaId, cinemas.id)).where(and(eq(halls.id, id), isNull(halls.archivedAt))).limit(1);
  if (!hall) notFound();
  const [seatRows, eventRows] = await Promise.all([
    getDb().select({ rowIndex: seats.rowIndex, columnIndex: seats.columnIndex, rowLabel: seats.rowLabel, columnLabel: seats.columnLabel, kind: seats.kind, selectable: seats.selectable, golden: seats.golden }).from(seats).where(eq(seats.hallId, id)).orderBy(asc(seats.rowIndex), asc(seats.columnIndex)),
    getDb().select({ status: events.status }).from(events).where(eq(events.hallId, id)),
  ]);
  const editable = canEditHallTemplate(eventRows.map((event) => event.status));
  const rows = Math.max(...seatRows.map((seat) => seat.rowIndex), 0) + 1;
  const columns = Math.max(...seatRows.map((seat) => seat.columnIndex), 0) + 1;
  return (
    <main className="admin-shell">
      <nav className="crumbs"><Link href="/admin/venues">影厅模板</Link><span>/</span><strong>编辑</strong></nav>
      <header className="section-header"><div><p className="eyebrow">{hall.cinemaName}</p><h1>{hall.name}</h1></div></header>
      {editable ? <HallTemplateEditForm id={hall.id} name={hall.name} layout={{ rows, columns, centerAfterColumn: hall.centerAfterColumn, cells: seatRows }} /> : <section className="panel"><h2>暂时不能编辑</h2><p className="form-error">该影厅模板仍有关联的草稿或进行中活动。请先结束相关活动，再编辑模板。</p><Link className="button" href="/admin/venues">返回影厅模板</Link></section>}
    </main>
  );
}

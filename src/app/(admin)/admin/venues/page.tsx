import Link from "next/link";
import { asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { AdminBackButton } from "@/features/admin/admin-back-button";
import { SeatLayoutEditor } from "@/features/venues/seat-layout-editor";
import { BlockedHallEditButton } from "@/features/venues/blocked-hall-edit-button";
import { HallTemplateImportForm } from "@/features/venues/hall-template-import-form";
import { HallTemplateDeleteButton } from "@/features/venues/hall-template-delete-button";
import { HallLayoutPreviewDialog } from "@/features/venues/hall-layout-preview-dialog";
import { getDb } from "@/server/db/client";
import { cinemas, events, halls, seats } from "@/server/db/schema";
import { canDeleteHallTemplate, canEditHallTemplate } from "@/server/domain/hall-template-edit";
import { requireAdmin } from "@/server/security/admin-session";
import { createCinemaAction, createHallAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function VenuesPage() {
  await requireAdmin();
  const [cinemaRows, hallRows] = await Promise.all([
    getDb().select().from(cinemas).orderBy(asc(cinemas.name)),
    getDb().select({ id: halls.id, cinemaId: halls.cinemaId, name: halls.name, centerAfterColumn: halls.centerAfterColumn, cinemaName: cinemas.name, seatCount: sql<number>`count(${seats.id})` }).from(halls).innerJoin(cinemas, eq(halls.cinemaId, cinemas.id)).leftJoin(seats, eq(seats.hallId, halls.id)).where(isNull(halls.archivedAt)).groupBy(halls.id, cinemas.name).orderBy(asc(cinemas.name), asc(halls.name)),
  ]);
  const [eventRows, seatRows] = hallRows.length ? await Promise.all([
    getDb().select({ hallId: events.hallId, status: events.status }).from(events).where(inArray(events.hallId, hallRows.map((hall) => hall.id))),
    getDb().select({ hallId: seats.hallId, rowIndex: seats.rowIndex, columnIndex: seats.columnIndex, rowLabel: seats.rowLabel, columnLabel: seats.columnLabel, kind: seats.kind, selectable: seats.selectable, golden: seats.golden }).from(seats).where(inArray(seats.hallId, hallRows.map((hall) => hall.id))).orderBy(asc(seats.rowIndex), asc(seats.columnIndex)),
  ]) : [[], []];
  return (
    <main className="admin-shell">
      <AdminBackButton href="/admin" label="控制台" />
      <nav className="crumbs"><Link href="/admin">控制台</Link><span>/</span><strong>影厅模板</strong></nav>
      <header className="section-header"><div><p className="eyebrow">场地基础资料</p><h1>影院与影厅</h1></div><span>{hallRows.length} 个影厅模板</span></header>
      <div className="admin-grid">
        <section className="panel"><h2>新增影院</h2><form action={createCinemaAction} className="stack-form"><label>影院名称<input name="name" required placeholder="例如：百丽宫影城" /></label><button className="button primary" type="submit">保存影院</button></form></section>
        <section className="panel"><div className="section-header compact"><h2>已有模板</h2>{hallRows.length ? <a className="button" href="/api/admin/venues/export?scope=all">导出全部</a> : null}</div>{hallRows.length ? <ul className="record-list">{hallRows.map((hall) => {
          const editable = canEditHallTemplate(eventRows.filter((event) => event.hallId === hall.id).map((event) => event.status));
          const label = `${hall.cinemaName} · ${hall.name}`;
          const linkedStatuses = eventRows.filter((event) => event.hallId === hall.id).map((event) => event.status);
          return <li key={hall.id}><div><strong>{label}</strong><span>{hall.seatCount} 个网格单元</span></div><div className="row-actions"><HallLayoutPreviewDialog label={label} cells={seatRows.filter((seat) => seat.hallId === hall.id)} centerAfterColumn={hall.centerAfterColumn} /><a href={`/api/admin/venues/export?scope=hall&id=${hall.id}`}>导出</a>{editable ? <Link className="text-button" href={`/admin/venues/${hall.id}/edit`}>编辑</Link> : <BlockedHallEditButton />}{canDeleteHallTemplate(linkedStatuses) ? <HallTemplateDeleteButton id={hall.id} label={label} /> : null}</div></li>;
        })}</ul> : <p className="muted">还没有影厅模板。</p>}<div className="cinema-export-list">{cinemaRows.filter((cinema) => hallRows.some((hall) => hall.cinemaId === cinema.id)).map((cinema) => <a className="button" href={`/api/admin/venues/export?scope=cinema&id=${cinema.id}`} key={cinema.id}>导出 {cinema.name}</a>)}</div></section>
      </div>
      <section className="panel wide"><h2>导入影厅模板</h2><p className="muted">支持导入单个影厅、单个影院或全部影院导出的 JSON 文件。同名影院会复用，影厅模板会新增，不覆盖已有模板。</p><HallTemplateImportForm /></section>
      <section className="panel wide"><h2>新建影厅模板</h2>{cinemaRows.length ? <form action={createHallAction} className="stack-form"><div className="form-row"><label>所属影院<select name="cinemaId" required>{cinemaRows.map((cinema) => <option value={cinema.id} key={cinema.id}>{cinema.name}</option>)}</select></label><label>影厅名称<input name="name" required placeholder="例如：6号激光厅" /></label></div><SeatLayoutEditor /><button className="button primary" type="submit">保存影厅模板</button></form> : <p className="muted">请先新增影院。</p>}</section>
    </main>
  );
}

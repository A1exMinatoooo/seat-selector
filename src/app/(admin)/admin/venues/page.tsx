import Link from "next/link";
import { asc, eq, sql } from "drizzle-orm";
import { SeatLayoutEditor } from "@/features/venues/seat-layout-editor";
import { HallTemplateImportForm } from "@/features/venues/hall-template-import-form";
import { getDb } from "@/server/db/client";
import { cinemas, halls, seats } from "@/server/db/schema";
import { requireAdmin } from "@/server/security/admin-session";
import { createCinemaAction, createHallAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function VenuesPage() {
  await requireAdmin();
  const [cinemaRows, hallRows] = await Promise.all([
    getDb().select().from(cinemas).orderBy(asc(cinemas.name)),
    getDb().select({ id: halls.id, cinemaId: halls.cinemaId, name: halls.name, cinemaName: cinemas.name, seatCount: sql<number>`count(${seats.id})` }).from(halls).innerJoin(cinemas, eq(halls.cinemaId, cinemas.id)).leftJoin(seats, eq(seats.hallId, halls.id)).groupBy(halls.id, cinemas.name).orderBy(asc(cinemas.name), asc(halls.name)),
  ]);
  return (
    <main className="admin-shell">
      <nav className="crumbs"><Link href="/admin">控制台</Link><span>/</span><strong>影厅模板</strong></nav>
      <header className="section-header"><div><p className="eyebrow">场地基础资料</p><h1>影院与影厅</h1></div><span>{hallRows.length} 个影厅模板</span></header>
      <div className="admin-grid">
        <section className="panel"><h2>新增影院</h2><form action={createCinemaAction} className="stack-form"><label>影院名称<input name="name" required placeholder="例如：百丽宫影城" /></label><button className="button primary" type="submit">保存影院</button></form></section>
        <section className="panel"><div className="section-header compact"><h2>已有模板</h2>{hallRows.length ? <a className="button" href="/api/admin/venues/export?scope=all">导出全部</a> : null}</div>{hallRows.length ? <ul className="record-list">{hallRows.map((hall) => <li key={hall.id}><div><strong>{hall.cinemaName} · {hall.name}</strong><span>{hall.seatCount} 个网格单元</span></div><a href={`/api/admin/venues/export?scope=hall&id=${hall.id}`}>导出</a></li>)}</ul> : <p className="muted">还没有影厅模板。</p>}<div className="cinema-export-list">{cinemaRows.filter((cinema) => hallRows.some((hall) => hall.cinemaId === cinema.id)).map((cinema) => <a className="button" href={`/api/admin/venues/export?scope=cinema&id=${cinema.id}`} key={cinema.id}>导出 {cinema.name}</a>)}</div></section>
      </div>
      <section className="panel wide"><h2>导入影厅模板</h2><p className="muted">支持导入单个影厅、单个影院或全部影院导出的 JSON 文件。同名影院会复用，影厅模板会新增，不覆盖已有模板。</p><HallTemplateImportForm /></section>
      <section className="panel wide"><h2>新建影厅模板</h2>{cinemaRows.length ? <form action={createHallAction} className="stack-form"><div className="form-row"><label>所属影院<select name="cinemaId" required>{cinemaRows.map((cinema) => <option value={cinema.id} key={cinema.id}>{cinema.name}</option>)}</select></label><label>影厅名称<input name="name" required placeholder="例如：6号激光厅" /></label></div><SeatLayoutEditor /><button className="button primary" type="submit">保存影厅模板</button></form> : <p className="muted">请先新增影院。</p>}</section>
    </main>
  );
}

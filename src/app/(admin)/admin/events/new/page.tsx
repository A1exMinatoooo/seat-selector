import Link from "next/link";
import { asc, eq, isNull } from "drizzle-orm";
import { TicketTypeFields } from "@/features/events/ticket-type-fields";
import { AdminBackButton } from "@/features/admin/admin-back-button";
import { AdminActionForm } from "@/features/admin/admin-action-form";
import { AdminSubmitButton } from "@/features/admin/admin-submit-button";
import { EventSeatEditor } from "@/features/events/event-seat-editor";
import { NumericInput } from "@/features/forms/numeric-input";
import { SearchableSelectField, SelectField } from "@/features/forms/select-field";
import { DatePickerField } from "@/features/forms/date-picker-field";
import { TimePickerField } from "@/features/forms/time-picker-field";
import { getDb } from "@/server/db/client";
import { cinemas, halls, locationPresets, seats } from "@/server/db/schema";
import { requireAdmin } from "@/server/security/admin-session";
import { supportedTimeZones } from "@/shared/date-time";
import { createEventAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewEventPage() {
  await requireAdmin();
  const [hallRows, locations, seatRows] = await Promise.all([
    getDb()
      .select({
        id: halls.id,
        hallName: halls.name,
        cinemaId: cinemas.id,
        cinemaName: cinemas.name,
      })
      .from(halls)
      .innerJoin(cinemas, eq(halls.cinemaId, cinemas.id))
      .where(isNull(halls.archivedAt))
      .orderBy(asc(cinemas.name), asc(halls.name)),
    getDb().select().from(locationPresets).orderBy(asc(locationPresets.name)),
    getDb().select().from(seats).orderBy(asc(seats.rowIndex), asc(seats.columnIndex)),
  ]);
  const layouts = hallRows.map((hall) => ({
    id: hall.id,
    cinemaId: hall.cinemaId,
    cinemaName: hall.cinemaName,
    hallName: hall.hallName,
    seats: seatRows.filter((seat) => seat.hallId === hall.id),
  }));
  const timeZones = supportedTimeZones();
  return (
    <main className="admin-shell">
      <AdminBackButton href="/admin/events" label="活动" />
      <nav className="crumbs">
        <Link href="/admin/events">活动</Link>
        <span>/</span>
        <strong>新建</strong>
      </nav>
      <header className="section-header">
        <div>
          <p className="eyebrow">新活动</p>
          <h1>建立选座活动</h1>
        </div>
      </header>
      {hallRows.length && locations.length ? (
        <AdminActionForm action={createEventAction} className="panel stack-form">
          <div className="form-row">
            <label>
              活动名称
              <input name="name" required placeholder="例如：八月特别观影会" />
            </label>
            <SearchableSelectField
              name="timeZone"
              label="显示时区"
              defaultValue="Asia/Shanghai"
              options={timeZones.map((timeZone) => ({ id: timeZone, label: timeZone }))}
              required
            />
          </div>
          <div className="form-row">
            <DatePickerField name="startDate" label="开始日期" required />
            <TimePickerField name="startTime" label="开始时间" required />
          </div>
          <div className="form-row">
            <SelectField
              name="locationId"
              label="活动地点"
              defaultValue={locations[0]?.id}
              options={locations.map((location) => ({ id: location.id, label: location.name }))}
              required
            />
            <label>
              定位半径（米）
              <NumericInput name="radiusMeters" min={50} max={100000} defaultValue={1000} />
            </label>
          </div>
          <label className="switch-label">
            <input name="locationCheckEnabled" type="checkbox" defaultChecked />
            <span className="switch-control" aria-hidden="true" />
            <span>开启活动定位检查</span>
          </label>
          <EventSeatEditor
            halls={layouts}
            initialHallId={hallRows[0]!.id}
            includeHallSelect
            planningToolsEnabled
          />
          <TicketTypeFields />
          <AdminSubmitButton pendingLabel="正在保存…">保存草稿</AdminSubmitButton>
        </AdminActionForm>
      ) : (
        <section className="panel">
          <p>请先建立至少一个影厅模板和活动地点。</p>
        </section>
      )}
    </main>
  );
}

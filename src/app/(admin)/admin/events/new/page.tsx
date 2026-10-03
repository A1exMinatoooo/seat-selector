import Link from "next/link";
import { TicketTypeFields } from "@/features/events/ticket-type-fields";
import { AdminBackButton } from "@/features/admin/admin-back-button";
import { AdminActionForm } from "@/features/admin/admin-action-form";
import { AdminSubmitButton } from "@/features/admin/admin-submit-button";
import { EventSeatEditor } from "@/features/events/event-seat-editor";
import { LocationCheckFields } from "@/features/events/location-check-fields";
import { SearchableSelectField, SelectField } from "@/features/forms/select-field";
import { DatePickerField } from "@/features/forms/date-picker-field";
import { TimePickerField } from "@/features/forms/time-picker-field";
import { getEventFormOptions } from "@/server/db/event-form-options";
import { eventStartDefaults } from "@/server/domain/event-start-defaults";
import { requireAdmin } from "@/server/security/admin-session";
import { supportedTimeZones } from "@/shared/date-time";
import { createEventAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewEventPage() {
  await requireAdmin();
  const { hallRows, locations, layouts } = await getEventFormOptions();
  const timeZones = supportedTimeZones();
  const start = eventStartDefaults(new Date(), "Asia/Shanghai");
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
              <input name="name" maxLength={100} required placeholder="例如：八月特别观影会" />
              <span className="muted">最多 100 个字符。</span>
            </label>
            <div data-field-error-key="timeZone">
              <SearchableSelectField
                name="timeZone"
                label="显示时区"
                defaultValue="Asia/Shanghai"
                options={timeZones.map((timeZone) => ({ id: timeZone, label: timeZone }))}
                required
              />
            </div>
          </div>
          <div className="form-row">
            <div data-field-error-key="startDate">
              <DatePickerField
                name="startDate"
                label="开始日期"
                defaultValue={start.date}
                required
              />
            </div>
            <div data-field-error-key="startTime">
              <TimePickerField
                name="startTime"
                label="开始时间"
                defaultValue={start.time}
                required
              />
            </div>
          </div>
          <LocationCheckFields>
            <div data-field-error-key="locationId">
              <SelectField
                name="locationId"
                label="活动地点"
                defaultValue={locations[0]?.id}
                options={locations.map((location) => ({ id: location.id, label: location.name }))}
                required
              />
            </div>
          </LocationCheckFields>
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

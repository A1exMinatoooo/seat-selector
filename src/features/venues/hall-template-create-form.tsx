"use client";

import { useState } from "react";
import { createHallAction } from "@/app/(admin)/admin/venues/actions";
import { AdminActionForm } from "@/features/admin/admin-action-form";
import { AdminSubmitButton } from "@/features/admin/admin-submit-button";
import { SelectField } from "@/features/forms/select-field";
import { SeatLayoutEditor } from "./seat-layout-editor";

export function HallTemplateCreateForm({
  cinemas,
}: {
  cinemas: Array<{ id: string; name: string }>;
}) {
  const [layoutResetKey, setLayoutResetKey] = useState(0);
  return (
    <AdminActionForm
      action={createHallAction}
      className="stack-form"
      resetOnSuccess
      onSuccess={() => setLayoutResetKey((key) => key + 1)}
    >
      <div className="form-row">
        <div data-field-error-key="cinemaId">
          <SelectField
            name="cinemaId"
            label="所属影院"
            defaultValue={cinemas[0]?.id}
            options={cinemas.map((cinema) => ({ id: cinema.id, label: cinema.name }))}
            required
          />
        </div>
        <label>
          影厅名称
          <input name="name" required maxLength={80} placeholder="例如：6号激光厅" />
          <span className="muted">最多 80 个字符。</span>
        </label>
      </div>
      <SeatLayoutEditor key={layoutResetKey} />
      <AdminSubmitButton pendingLabel="正在保存…">保存影厅模板</AdminSubmitButton>
    </AdminActionForm>
  );
}

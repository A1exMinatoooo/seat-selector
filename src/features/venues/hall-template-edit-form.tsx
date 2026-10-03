"use client";

import { updateHallAction } from "@/app/(admin)/admin/venues/actions";
import { AdminActionForm } from "@/features/admin/admin-action-form";
import { AdminSubmitButton } from "@/features/admin/admin-submit-button";
import { SeatLayoutEditor, type EditableHallLayout } from "./seat-layout-editor";

export function HallTemplateEditForm({
  id,
  name,
  layout,
}: {
  id: string;
  name: string;
  layout: EditableHallLayout;
}) {
  return (
    <AdminActionForm
      action={updateHallAction}
      className="panel stack-form"
    >
      <input type="hidden" name="id" value={id} />
      <label>
        影厅名称
        <input name="name" required maxLength={80} defaultValue={name} />
        <span className="muted">最多 80 个字符。</span>
      </label>
      <SeatLayoutEditor initialLayout={layout} />
      <p className="muted">保存新版模板会归档当前版本。</p>
      <AdminSubmitButton pendingLabel="正在保存…">保存新版模板</AdminSubmitButton>
    </AdminActionForm>
  );
}

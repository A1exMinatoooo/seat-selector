"use client";

import { importHallTemplatesAction } from "@/app/(admin)/admin/venues/actions";
import { AdminActionForm } from "@/features/admin/admin-action-form";
import { AdminSubmitButton } from "@/features/admin/admin-submit-button";

export function HallTemplateImportForm() {
  return (
    <AdminActionForm
      action={importHallTemplatesAction}
      className="stack-form template-import-form"
      resetOnSuccess
    >
      <label>
        模板文件
        <input name="template" type="file" accept="application/json,.json" required />
        <span className="muted">仅接受 JSON 模板文件，文件大小不超过 10 MiB。</span>
      </label>
      <AdminSubmitButton pendingLabel="正在导入…">导入模板</AdminSubmitButton>
    </AdminActionForm>
  );
}

"use client";

import { archiveHallAction } from "@/app/(admin)/admin/venues/actions";
import { AdminActionForm } from "@/features/admin/admin-action-form";
import { AdminSubmitButton } from "@/features/admin/admin-submit-button";

export function HallTemplateArchiveButton({ id, label }: { id: string; label: string }) {
  return (
    <AdminActionForm
      action={archiveHallAction}
      className="inline-form"
      confirmMessage={`确定归档影厅模板“${label}”吗？归档后它将不再出现在可用模板中。`}
    >
      <input type="hidden" name="id" value={id} />
      <AdminSubmitButton className="text-button danger" pendingLabel="归档中…">
        归档
      </AdminSubmitButton>
    </AdminActionForm>
  );
}

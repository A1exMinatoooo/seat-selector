"use client";

import { useState } from "react";
import { createLocationAction } from "@/app/(admin)/admin/locations/actions";
import { AdminActionForm } from "@/features/admin/admin-action-form";
import { AdminSubmitButton } from "@/features/admin/admin-submit-button";
import { LocationPresetFields } from "./location-preset-fields";

export function LocationPresetCreateForm() {
  const [resetKey, setResetKey] = useState(0);
  return (
    <AdminActionForm
      action={createLocationAction}
      className="stack-form"
      onSuccess={(submission) => setResetKey(submission)}
    >
      <LocationPresetFields key={resetKey} />
      <AdminSubmitButton pendingLabel="正在保存…">保存地点</AdminSubmitButton>
    </AdminActionForm>
  );
}

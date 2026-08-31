"use client";

import { useActionState } from "react";
import { createLocationAction } from "@/app/(admin)/admin/locations/actions";
import { initialAdminActionState } from "@/features/admin/admin-action-state";
import { useAdminActionToast } from "@/features/admin/admin-toast";
import { LocationPresetFields } from "./location-preset-fields";

export function LocationPresetCreateForm() {
  const [state, action, pending] = useActionState(createLocationAction, {
    ...initialAdminActionState,
    resetKey: 0,
  });
  useAdminActionToast(state);

  return (
    <form action={action} className="stack-form">
      <LocationPresetFields key={state.resetKey} />
      <button className="button primary" type="submit" disabled={pending}>
        {pending ? "正在保存…" : "保存地点"}
      </button>
    </form>
  );
}

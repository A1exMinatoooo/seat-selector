"use client";

import { useActionState } from "react";
import { updateHallAction, type HallTemplateUpdateState } from "@/app/(admin)/admin/venues/actions";
import { useAdminActionToast } from "@/features/admin/admin-toast";
import { SeatLayoutEditor, type EditableHallLayout } from "./seat-layout-editor";

const initialState: HallTemplateUpdateState = {
  status: "idle",
  message: "",
  submission: 0,
  code: null,
};

export function HallTemplateEditForm({
  id,
  name,
  layout,
}: {
  id: string;
  name: string;
  layout: EditableHallLayout;
}) {
  const [state, action, pending] = useActionState(updateHallAction, initialState);
  useAdminActionToast(state);
  return (
    <form action={action} className="panel stack-form">
      <input type="hidden" name="id" value={id} />
      <label>
        影厅名称
        <input name="name" required defaultValue={name} />
      </label>
      <SeatLayoutEditor initialLayout={layout} />
      <button className="button primary" type="submit" disabled={pending}>
        {pending ? "正在保存…" : "保存新版模板"}
      </button>
    </form>
  );
}

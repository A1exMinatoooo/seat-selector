"use client";

import { useActionState } from "react";
import {
  deleteLocationAction,
  type LocationDeleteState,
} from "@/app/(admin)/admin/locations/actions";
import { useAdminActionToast } from "@/features/admin/admin-toast";

const initialState: LocationDeleteState = {
  status: "idle",
  message: "",
  submission: 0,
  code: null,
};

export function LocationDeleteButton({ id, label }: { id: string; label: string }) {
  const [state, action, pending] = useActionState(deleteLocationAction, initialState);
  useAdminActionToast(state);
  return (
    <form
      action={action}
      className="inline-form"
      onSubmit={(event) => {
        if (!window.confirm(`确定删除活动地点“${label}”吗？`)) event.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button className="text-button danger" type="submit" disabled={pending}>
        {pending ? "删除中…" : "删除"}
      </button>
    </form>
  );
}

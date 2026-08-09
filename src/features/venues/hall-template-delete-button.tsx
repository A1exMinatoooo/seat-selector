"use client";

import { useActionState } from "react";
import { archiveHallAction, type HallTemplateDeleteState } from "@/app/(admin)/admin/venues/actions";

const initialState: HallTemplateDeleteState = { status: "idle", message: "", submission: 0 };

export function HallTemplateDeleteButton({ id, label }: { id: string; label: string }) {
  const [state, action, pending] = useActionState(archiveHallAction, initialState);
  return <form action={action} className="inline-form" onSubmit={(event) => { if (!window.confirm(`确定删除座位布局“${label}”吗？`)) event.preventDefault(); }}>
    <input type="hidden" name="id" value={id} />
    <button className="text-button danger" type="submit" disabled={pending}>{pending ? "删除中…" : "删除"}</button>
    {state.status === "error" ? <span className="form-error" role="alert">{state.message}</span> : null}
  </form>;
}

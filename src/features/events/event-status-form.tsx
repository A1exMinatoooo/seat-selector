"use client";

import { useActionState } from "react";
import { setEventStatusAction, type EventStatusSaveState } from "@/app/(admin)/admin/events/actions";

const initialState: EventStatusSaveState = { status: "idle", message: "", submission: 0, code: null };

export function EventStatusForm({ eventId, status }: { eventId: string; status: "draft" | "open" | "ended" }) {
  const ending = status === "open";
  const reopening = status === "ended";
  const [state, formAction, pending] = useActionState(setEventStatusAction, initialState);
  return (
    <form action={formAction} className="inline-form" onSubmit={(event) => {
      if (ending && !window.confirm("确定要结束该活动吗？结束后将不能继续选座或修改座位开放范围。")) event.preventDefault();
      if (reopening && !window.confirm("确定要重新开放该活动吗？参与者将可以再次进入活动，现有名单与选座记录会保留。")) event.preventDefault();
    }}>
      <input type="hidden" name="id" value={eventId} />
      <input type="hidden" name="status" value={ending ? "ended" : "open"} />
      <button className={`button ${ending ? "danger" : "primary"}`} type="submit" disabled={pending}>{pending ? "正在更新…" : ending ? "结束活动" : reopening ? "重新开放" : "开放选座"}</button>
      {state.status === "error" ? <span key={state.submission} className="form-error" role="alert">{state.message}</span> : null}
    </form>
  );
}

"use client";

import { setEventStatusAction } from "@/app/(admin)/admin/events/actions";

export function EventStatusForm({ eventId, status }: { eventId: string; status: "draft" | "open" }) {
  const ending = status === "open";
  return (
    <form action={setEventStatusAction} onSubmit={(event) => {
      if (ending && !window.confirm("确定要结束该活动吗？结束后将不能继续选座或修改座位开放范围。")) event.preventDefault();
    }}>
      <input type="hidden" name="id" value={eventId} />
      <input type="hidden" name="status" value={ending ? "ended" : "open"} />
      <button className={`button ${ending ? "danger" : "primary"}`} type="submit">{ending ? "结束活动" : "开放选座"}</button>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { updateEventSeatsAction, type SeatAvailabilitySaveState } from "@/app/(admin)/admin/events/actions";
import { EventSeatEditor, type EventHallLayout } from "./event-seat-editor";

const initialState: SeatAvailabilitySaveState = { status: "idle", message: "", submission: 0 };

export function EventSeatManagementForm({
  eventId,
  version,
  hall,
  initialAvailableSeatIds,
  lockedSeatIds,
  centerAfterColumn,
  enableHalfLockControls,
}: {
  eventId: string;
  version: number;
  hall: EventHallLayout;
  initialAvailableSeatIds: string[];
  lockedSeatIds: string[];
  centerAfterColumn: number | null;
  enableHalfLockControls: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateEventSeatsAction, initialState);
  return (
    <>
      <form action={formAction} className="panel wide stack-form">
        <input type="hidden" name="id" value={eventId} />
        <EventSeatEditor
          key={version}
          halls={[hall]}
          initialHallId={hall.id}
          initialAvailableSeatIds={initialAvailableSeatIds}
          lockedSeatIds={lockedSeatIds}
          centerAfterColumn={centerAfterColumn}
          enableHalfLockControls={enableHalfLockControls}
        />
        <button className="button primary" type="submit" disabled={pending}>{pending ? "正在保存…" : "保存活动开放范围"}</button>
      </form>
      {state.status !== "idle" ? <div key={state.submission} className={`toast admin-save-toast ${state.status}`} role={state.status === "error" ? "alert" : "status"}>{state.message}</div> : null}
    </>
  );
}

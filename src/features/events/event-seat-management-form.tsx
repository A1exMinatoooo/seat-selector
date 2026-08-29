"use client";

import { useActionState } from "react";
import {
  updateEventSeatsAction,
  type SeatAvailabilitySaveState,
} from "@/app/(admin)/admin/events/actions";
import { useAdminActionToast } from "@/features/admin/admin-toast";
import { EventSeatEditor, type EventHallLayout } from "./event-seat-editor";

const initialState: SeatAvailabilitySaveState = {
  status: "idle",
  message: "",
  submission: 0,
  code: null,
};

export function EventSeatManagementForm({
  eventId,
  version,
  hall,
  initialAvailableSeatIds,
  lockedSeatIds,
  initialLockedSeatHalf,
  centerAfterColumn,
  enableHalfLockControls,
  planningToolsEnabled,
}: {
  eventId: string;
  version: number;
  hall: EventHallLayout;
  initialAvailableSeatIds: string[];
  lockedSeatIds: string[];
  initialLockedSeatHalf: "left" | "right" | null;
  centerAfterColumn: number | null;
  enableHalfLockControls: boolean;
  planningToolsEnabled: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateEventSeatsAction, initialState);
  useAdminActionToast(state);
  return (
    <form action={formAction} className="panel wide stack-form">
      <input type="hidden" name="id" value={eventId} />
      <EventSeatEditor
        key={version}
        halls={[hall]}
        initialHallId={hall.id}
        initialAvailableSeatIds={initialAvailableSeatIds}
        lockedSeatIds={lockedSeatIds}
        initialLockedSeatHalf={initialLockedSeatHalf}
        centerAfterColumn={centerAfterColumn}
        enableHalfLockControls={enableHalfLockControls}
        planningToolsEnabled={planningToolsEnabled}
      />
      <button className="button primary" type="submit" disabled={pending}>
        {pending ? "正在保存…" : "保存活动开放范围"}
      </button>
    </form>
  );
}

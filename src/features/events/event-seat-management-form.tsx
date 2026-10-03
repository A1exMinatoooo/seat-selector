"use client";

import { updateEventSeatsAction } from "@/app/(admin)/admin/events/actions";
import { AdminActionForm } from "@/features/admin/admin-action-form";
import { AdminSubmitButton } from "@/features/admin/admin-submit-button";
import { EventSeatEditor, type EventHallLayout } from "./event-seat-editor";

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
  return (
    <AdminActionForm action={updateEventSeatsAction} className="panel wide stack-form">
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
      <AdminSubmitButton pendingLabel="正在保存…">保存活动开放范围</AdminSubmitButton>
    </AdminActionForm>
  );
}

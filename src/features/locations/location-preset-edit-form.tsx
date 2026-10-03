"use client";

import { updateLocationAction } from "@/app/(admin)/admin/locations/actions";
import { AdminActionForm } from "@/features/admin/admin-action-form";
import { AdminSubmitButton } from "@/features/admin/admin-submit-button";
import { LocationPresetFields } from "./location-preset-fields";

type LocationPreset = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  defaultRadiusMeters: number;
};

export function LocationPresetEditForm({ location }: { location: LocationPreset }) {
  return (
    <AdminActionForm action={updateLocationAction} className="panel stack-form">
      <p className="muted">
        保存后，名称和坐标会立即应用到所有引用该地点的活动，包括进行中的活动；活动单独设置的定位半径不会被覆盖。
      </p>
      <input type="hidden" name="id" value={location.id} />
      <LocationPresetFields initialValues={location} />
      <AdminSubmitButton pendingLabel="正在保存…">保存地点变更</AdminSubmitButton>
    </AdminActionForm>
  );
}

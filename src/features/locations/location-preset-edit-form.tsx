"use client";

import { useActionState } from "react";
import {
  updateLocationAction,
  type LocationUpdateState,
} from "@/app/(admin)/admin/locations/actions";
import { useAdminActionToast } from "@/features/admin/admin-toast";
import { LocationPresetFields } from "./location-preset-fields";

const initialState: LocationUpdateState = {
  status: "idle",
  message: "",
  submission: 0,
  code: null,
};

type LocationPreset = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  defaultRadiusMeters: number;
};

export function LocationPresetEditForm({ location }: { location: LocationPreset }) {
  const [state, action, pending] = useActionState(updateLocationAction, initialState);
  useAdminActionToast(state);
  return (
    <form action={action} className="panel stack-form">
      <p className="muted">
        保存后，名称和坐标会立即应用到所有引用该地点的活动，包括进行中的活动；活动单独设置的定位半径不会被覆盖。
      </p>
      <input type="hidden" name="id" value={location.id} />
      <LocationPresetFields initialValues={location} />
      <button className="button primary" type="submit" disabled={pending}>
        {pending ? "正在保存…" : "保存地点变更"}
      </button>
    </form>
  );
}

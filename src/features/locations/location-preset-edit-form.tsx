"use client";

import { useActionState } from "react";
import {
  updateLocationAction,
  type LocationUpdateState,
} from "@/app/(admin)/admin/locations/actions";
import { useAdminActionToast } from "@/features/admin/admin-toast";
import { NumericInput } from "@/features/forms/numeric-input";

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
      <label>
        地点名称
        <input name="name" required maxLength={80} defaultValue={location.name} />
      </label>
      <div className="form-row">
        <label>
          纬度
          <NumericInput
            name="latitude"
            step="any"
            min={-90}
            max={90}
            defaultValue={location.latitude}
          />
        </label>
        <label>
          经度
          <NumericInput
            name="longitude"
            step="any"
            min={-180}
            max={180}
            defaultValue={location.longitude}
          />
        </label>
      </div>
      <label>
        默认范围（米）
        <NumericInput
          name="defaultRadiusMeters"
          min={50}
          max={100000}
          defaultValue={location.defaultRadiusMeters}
        />
      </label>
      <button className="button primary" type="submit" disabled={pending}>
        {pending ? "正在保存…" : "保存地点变更"}
      </button>
    </form>
  );
}

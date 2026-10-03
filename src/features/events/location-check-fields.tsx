"use client";

import { useState, type ReactNode } from "react";
import { NumericInput } from "@/features/forms/numeric-input";

export function LocationCheckFields({
  children,
  defaultEnabled = false,
  defaultRadiusMeters = 1000,
}: {
  children: ReactNode;
  defaultEnabled?: boolean;
  defaultRadiusMeters?: number;
}) {
  const [enabled, setEnabled] = useState(defaultEnabled);

  return (
    <>
      <div className="form-row">
        {children}
        <label className="location-radius-field" hidden={!enabled}>
          定位半径（米）
          <NumericInput
            name="radiusMeters"
            min={50}
            max={100000}
            defaultValue={defaultRadiusMeters}
          />
          <span className="muted">范围为 50 至 100,000 米。</span>
        </label>
      </div>
      <label className="switch-label">
        <input
          name="locationCheckEnabled"
          type="checkbox"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
        />
        <span className="switch-control" aria-hidden="true" />
        <span>开启活动定位检查</span>
      </label>
    </>
  );
}

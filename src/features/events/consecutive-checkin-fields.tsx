"use client";

import { useState } from "react";

export type ConsecutiveTargetOption = {
  id: string;
  name: string;
  startsAtLabel: string;
  status: "draft" | "open";
};

export function ConsecutiveCheckinFields({
  initialTargetIds,
  candidates,
}: {
  initialTargetIds: string[];
  candidates: ConsecutiveTargetOption[];
}) {
  const persistedSelectionKey = [...initialTargetIds].sort().join(",") || "disabled";

  return (
    <ConsecutiveCheckinFieldState
      key={persistedSelectionKey}
      initialTargetIds={initialTargetIds}
      candidates={candidates}
    />
  );
}

function ConsecutiveCheckinFieldState({
  initialTargetIds,
  candidates,
}: {
  initialTargetIds: string[];
  candidates: ConsecutiveTargetOption[];
}) {
  const [enabled, setEnabled] = useState(initialTargetIds.length > 0);
  const [selected, setSelected] = useState(() => new Set(initialTargetIds));

  function toggleTarget(targetId: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(targetId);
      else next.delete(targetId);
      return next;
    });
  }

  return (
    <>
      <input type="hidden" name="targetEventIds" value={JSON.stringify([...selected])} />
      <label className="switch-label">
        <input
          name="enabled"
          type="checkbox"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
        />
        <span className="switch-control" aria-hidden="true" />
        <span>开启同日连续签到</span>
      </label>
      {enabled ? (
        <fieldset className="consecutive-targets">
          <legend>连签活动</legend>
          {candidates.length ? (
            <div className="consecutive-target-list">
              {candidates.map((candidate) => (
                <label key={candidate.id}>
                  <input
                    type="checkbox"
                    checked={selected.has(candidate.id)}
                    onChange={(event) => toggleTarget(candidate.id, event.target.checked)}
                  />
                  <span>
                    <strong>{candidate.name}</strong>
                    <small>
                      {candidate.startsAtLabel} · {candidate.status === "open" ? "开放中" : "草稿"}
                    </small>
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <p className="muted">当前没有符合条件的同日后续现场活动。</p>
          )}
        </fieldset>
      ) : null}
    </>
  );
}

"use client";

import { Ban, X } from "lucide-react";
import { displaySeatNumber, formatSeatLabel } from "@/shared/seat-label";

export type ParticipantSeatDto = {
  id: string;
  rowIndex: number;
  columnIndex: number;
  rowLabel: string;
  columnLabel: string;
  kind: "seat" | "aisle" | "empty";
  selectable: boolean;
  golden: boolean;
};

export function SeatStateIcon({
  state,
  size,
}: {
  state: "occupied" | "blocked";
  size: 14 | 22;
}) {
  const Icon = state === "occupied" ? X : Ban;
  return (
    <Icon
      className="seat-state-icon"
      data-seat-state-icon={state}
      aria-hidden="true"
      size={size}
      strokeWidth={2}
    />
  );
}

export function ParticipantSeatLegend() {
  return (
    <div className="legend participant-legend" aria-label="参与者座位图图例">
      <span className="available">可选</span>
      <span className="golden">黄金区</span>
      <span className="mine">我的选择</span>
      <span className="occupied">
        <SeatStateIcon state="occupied" size={14} />
        他人已选
      </span>
      <span className="blocked">
        <SeatStateIcon state="blocked" size={14} />
        不可选
      </span>
      <span className="divider">左右半场中线</span>
    </div>
  );
}

export function ParticipantSeatButton({
  seat,
  occupied,
  available,
  selected,
  interactionDisabled = false,
  onSelect,
}: {
  seat: ParticipantSeatDto;
  occupied: boolean;
  available: boolean;
  selected: boolean;
  interactionDisabled?: boolean;
  onSelect: (seat: ParticipantSeatDto) => void;
}) {
  const blocked = seat.kind === "seat" && (!seat.selectable || !available);
  const label = formatSeatLabel(seat.rowLabel, seat.columnLabel);
  const stateLabel = occupied
    ? "已被他人选择"
    : blocked
      ? "不可选"
      : selected
        ? "我的选择"
        : "可选";

  return (
    <button
      type="button"
      aria-label={`${label}：${stateLabel}`}
      disabled={interactionDisabled || seat.kind !== "seat" || (!occupied && blocked)}
      className={`public-seat ${seat.kind} ${seat.golden && !blocked && !occupied ? "golden" : ""} ${occupied ? "occupied" : ""} ${blocked && !occupied ? "blocked" : ""} ${selected ? "mine" : ""}`}
      onClick={() => onSelect(seat)}
    >
      {seat.kind === "seat" ? (
        occupied ? (
          <SeatStateIcon state="occupied" size={22} />
        ) : blocked ? (
          <SeatStateIcon state="blocked" size={22} />
        ) : (
          displaySeatNumber(seat.columnLabel)
        )
      ) : (
        ""
      )}
    </button>
  );
}

"use client";

import { useMemo, useRef, useState } from "react";

export type EventSeat = {
  id: string;
  rowIndex: number;
  columnIndex: number;
  rowLabel: string;
  columnLabel: string;
  kind: "seat" | "aisle" | "empty";
  selectable: boolean;
  golden: boolean;
};

export type EventHallLayout = {
  id: string;
  name: string;
  seats: EventSeat[];
};

export function EventSeatEditor({
  halls,
  initialHallId,
  initialAvailableSeatIds,
  lockedSeatIds = [],
  includeHallSelect = false,
}: {
  halls: EventHallLayout[];
  initialHallId: string;
  initialAvailableSeatIds?: string[];
  lockedSeatIds?: string[];
  includeHallSelect?: boolean;
}) {
  const [hallId, setHallId] = useState(initialHallId);
  const hall = halls.find((item) => item.id === hallId) ?? halls[0];
  const defaultSeatIds = useMemo(
    () => hall?.seats.filter((seat) => seat.kind === "seat" && seat.selectable).map((seat) => seat.id) ?? [],
    [hall],
  );
  const [available, setAvailable] = useState(() => new Set(initialAvailableSeatIds ?? defaultSeatIds));
  const locked = useMemo(() => new Set(lockedSeatIds), [lockedSeatIds]);
  const painting = useRef<boolean | null>(null);
  const columns = Math.max(...(hall?.seats.map((seat) => seat.columnIndex) ?? [0])) + 1;

  function paint(seatId: string) {
    if (painting.current === null || locked.has(seatId)) return;
    setAvailable((current) => {
      const next = new Set(current);
      if (painting.current) next.add(seatId);
      else next.delete(seatId);
      return next;
    });
  }

  if (!hall) return null;

  return (
    <fieldset className="layout-editor event-seat-editor">
      <legend>活动可选区域</legend>
      {includeHallSelect ? (
        <label>
          影厅
          <select name="hallId" value={hall.id} onChange={(event) => {
            const nextHallId = event.target.value;
            const nextHall = halls.find((item) => item.id === nextHallId);
            setHallId(nextHallId);
            setAvailable(new Set(nextHall?.seats.filter((seat) => seat.kind === "seat" && seat.selectable).map((seat) => seat.id) ?? []));
          }}>
            {halls.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
      ) : null}
      <p className="muted">按住鼠标或手指拖动可连续选择。绿色座位开放，灰色座位不开放。</p>
      <div className="tool-row">
        <button type="button" onClick={() => setAvailable(new Set(defaultSeatIds))}>全部开放</button>
        <button type="button" onClick={() => setAvailable(new Set(lockedSeatIds))}>全部关闭</button>
        <span>{available.size} 个座位开放</span>
      </div>
      <div
        className="seat-grid event-seat-grid"
        style={{ gridTemplateColumns: `repeat(${columns}, 36px)` }}
        onPointerMove={(event) => {
          if (painting.current === null) return;
          const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-event-seat-id]");
          if (target?.dataset.eventSeatId) paint(target.dataset.eventSeatId);
        }}
        onPointerUp={() => { painting.current = null; }}
        onPointerCancel={() => { painting.current = null; }}
        onPointerLeave={(event) => { if (event.pointerType === "mouse") painting.current = null; }}
      >
        {hall.seats.map((seat) => {
          const structural = seat.kind !== "seat" || !seat.selectable;
          const isLocked = locked.has(seat.id);
          const isAvailable = available.has(seat.id);
          return (
            <button
              key={seat.id}
              type="button"
              data-event-seat-id={seat.id}
              disabled={structural || isLocked}
              title={`${seat.rowLabel} ${seat.columnLabel}${isLocked ? "（已被选择，不能关闭）" : ""}`}
              aria-label={`${seat.rowLabel}${seat.columnLabel}：${isLocked ? "已选" : isAvailable ? "开放" : "关闭"}`}
              className={`editor-seat ${seat.kind} ${isAvailable ? "available" : "blocked"} ${isLocked ? "locked" : ""}`}
              onPointerDown={(event) => {
                if (structural || isLocked) return;
                event.preventDefault();
                painting.current = !isAvailable;
                paint(seat.id);
              }}
            >
              {seat.kind === "seat" ? seat.columnIndex + 1 : ""}
            </button>
          );
        })}
      </div>
      <input type="hidden" name="availableSeatIds" value={JSON.stringify([...available])} />
    </fieldset>
  );
}

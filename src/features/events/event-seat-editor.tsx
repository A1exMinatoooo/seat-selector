"use client";

import { useMemo, useRef, useState } from "react";
import { detectLockedSeatHalf, toggleSeatHalfLock, type SeatHalf } from "@/server/domain/event-seat-availability";
import { SeatGridViewport } from "@/features/seating/seat-grid-viewport";
import { displaySeatNumber, formatSeatLabel } from "@/shared/seat-label";

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

const EMPTY_SEAT_IDS: string[] = [];

export function EventSeatEditor({
  halls,
  initialHallId,
  initialAvailableSeatIds,
  lockedSeatIds = EMPTY_SEAT_IDS,
  includeHallSelect = false,
  enableHalfLockControls = false,
  centerAfterColumn = null,
}: {
  halls: EventHallLayout[];
  initialHallId: string;
  initialAvailableSeatIds?: string[];
  lockedSeatIds?: string[];
  includeHallSelect?: boolean;
  enableHalfLockControls?: boolean;
  centerAfterColumn?: number | null;
}) {
  const [hallId, setHallId] = useState(initialHallId);
  const hall = halls.find((item) => item.id === hallId) ?? halls[0];
  const defaultSeatIds = useMemo(
    () => hall?.seats.filter((seat) => seat.kind === "seat" && seat.selectable).map((seat) => seat.id) ?? [],
    [hall],
  );
  const [available, setAvailable] = useState(() => new Set(initialAvailableSeatIds ?? defaultSeatIds));
  const [interactionMode, setInteractionMode] = useState<"navigate" | "edit">("navigate");
  const [changeSource, setChangeSource] = useState<"manual" | "half_lock" | "half_unlock" | "half_switch">("manual");
  const [changedSide, setChangedSide] = useState<SeatHalf | "">("");
  const locked = useMemo(() => new Set(lockedSeatIds), [lockedSeatIds]);
  const painting = useRef<boolean | null>(null);
  const columns = Math.max(...(hall?.seats.map((seat) => seat.columnIndex) ?? [0])) + 1;
  const rowIndexes = [...new Set(hall?.seats.map((seat) => seat.rowIndex) ?? [])];
  const positionedSeats = useMemo(() => hall?.seats.map((seat) => ({ ...seat, templateSelectable: seat.selectable })) ?? [], [hall]);
  const activeLockedHalf = detectLockedSeatHalf(positionedSeats, available, locked, centerAfterColumn);

  function markManualChange() {
    setChangeSource("manual");
    setChangedSide("");
  }

  function paint(seatId: string) {
    if (interactionMode !== "edit" || painting.current === null || locked.has(seatId)) return;
    markManualChange();
    setAvailable((current) => {
      const next = new Set(current);
      if (painting.current) next.add(seatId);
      else next.delete(seatId);
      return next;
    });
  }

  function toggleHalf(side: SeatHalf) {
    const result = toggleSeatHalfLock(positionedSeats, available, locked, side, centerAfterColumn);
    setAvailable(new Set(result.availableSeatIds));
    setChangeSource(`half_${result.operation}`);
    setChangedSide(side);
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
            markManualChange();
          }}>
            {halls.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
      ) : null}
      {enableHalfLockControls ? <div className="half-lock-controls"><div><strong>快速锁定半场</strong><p className="muted">左右半场互斥；再次点击当前启用的按钮可取消锁定。调整完成后点击下方保存按钮才会生效。</p></div><div className="header-actions"><button className={`button ${activeLockedHalf === "left" ? "primary" : ""}`} aria-pressed={activeLockedHalf === "left"} type="button" onClick={() => toggleHalf("left")}>{activeLockedHalf === "left" ? "取消锁定左半场" : "锁定左半场"}</button><button className={`button ${activeLockedHalf === "right" ? "primary" : ""}`} aria-pressed={activeLockedHalf === "right"} type="button" onClick={() => toggleHalf("right")}>{activeLockedHalf === "right" ? "取消锁定右半场" : "锁定右半场"}</button></div></div> : null}
      <p className="muted">绿色座位开放，灰色座位不开放。</p>
      <div className="tool-row">
        <button type="button" onClick={() => { setAvailable(new Set(defaultSeatIds)); markManualChange(); }}>全部开放</button>
        <button type="button" onClick={() => { setAvailable(new Set(lockedSeatIds)); markManualChange(); }}>全部关闭</button>
        <span>{available.size} 个座位开放</span>
      </div>
      <div className="tool-row" role="toolbar" aria-label="活动座位网格操作模式"><strong>网格操作</strong>
        <button className={interactionMode === "navigate" ? "active" : ""} aria-pressed={interactionMode === "navigate"} type="button" onClick={() => { painting.current = null; setInteractionMode("navigate"); }}>无修改</button>
        <button className={interactionMode === "edit" ? "active" : ""} aria-pressed={interactionMode === "edit"} type="button" onClick={() => setInteractionMode("edit")}>调整可选区域</button>
      </div>
      <SeatGridViewport ariaLabel="活动座位开放区域" className="editor-grid-viewport" gesturesEnabled={interactionMode === "navigate"} interactionHint={<p className="grid-interaction-hint muted" role="status" aria-live="polite">{interactionMode === "navigate" ? "当前为“无修改”模式：单指拖动可移动网格，双指可缩放；也可使用上方缩放按钮。" : "当前为“调整可选区域”模式：点击或拖动可开放、关闭座位；如需移动或双指缩放，请切换到“无修改”。"}</p>}>
        <div
          className="seat-grid event-seat-grid"
          style={{ gridTemplateColumns: `max-content repeat(${columns}, 36px)` }}
          onPointerMove={(event) => {
            if (painting.current === null) return;
            const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-event-seat-id]");
            if (target?.dataset.eventSeatId) paint(target.dataset.eventSeatId);
          }}
          onPointerUp={() => { painting.current = null; }}
          onPointerCancel={() => { painting.current = null; }}
          onPointerLeave={(event) => { if (event.pointerType === "mouse") painting.current = null; }}
        >
        {rowIndexes.map((rowIndex) => <div className="seat-coordinate-row" style={{ gridColumn: `1 / span ${columns + 1}`, gridTemplateColumns: `max-content repeat(${columns}, 36px)` }} key={`row:${rowIndex}`}><span className="seat-coordinate row">{hall.seats.find((seat) => seat.rowIndex === rowIndex)?.rowLabel ?? rowIndex + 1}</span>{hall.seats.filter((seat) => seat.rowIndex === rowIndex).map((seat) => {
          const structural = seat.kind !== "seat" || !seat.selectable;
          const isLocked = locked.has(seat.id);
          const isAvailable = available.has(seat.id);
          return (
            <button
              key={seat.id}
              type="button"
              data-event-seat-id={seat.id}
              disabled={structural || isLocked}
              title={`${formatSeatLabel(seat.rowLabel, seat.columnLabel)}${isLocked ? "（已被选择，不能关闭）" : ""}`}
              aria-label={`${formatSeatLabel(seat.rowLabel, seat.columnLabel)}：${isLocked ? "已选" : isAvailable ? "开放" : "关闭"}`}
              aria-pressed={isAvailable}
              className={`editor-seat ${seat.kind} ${isAvailable ? "available" : "blocked"} ${seat.golden && isAvailable ? "golden" : ""} ${isLocked ? "locked" : ""} ${centerAfterColumn === seat.columnIndex ? "center-divider" : ""}`}
              aria-disabled={interactionMode === "navigate" || undefined}
              tabIndex={interactionMode === "navigate" ? -1 : undefined}
              onPointerDown={(event) => {
                if (interactionMode !== "edit" || structural || isLocked) return;
                event.preventDefault();
                painting.current = !isAvailable;
                paint(seat.id);
              }}
              onClick={(event) => {
                if (interactionMode !== "edit" || event.detail !== 0 || structural || isLocked) return;
                painting.current = !isAvailable;
                paint(seat.id);
                painting.current = null;
              }}
            >
              {seat.kind === "seat" ? displaySeatNumber(seat.columnLabel) : ""}
            </button>
          );
        })}</div>)}
        </div>
      </SeatGridViewport>
      <input type="hidden" name="availableSeatIds" value={JSON.stringify([...available])} />
      <input type="hidden" name="changeSource" value={changeSource} />
      {changedSide ? <input type="hidden" name="side" value={changedSide} /> : null}
    </fieldset>
  );
}

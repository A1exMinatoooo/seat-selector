"use client";

import { useMemo, useRef, useState } from "react";
import {
  detectLockedSeatHalf,
  toggleSeatHalfLock,
  type SeatHalf,
} from "@/server/domain/event-seat-availability";
import { SeatGridViewport } from "@/features/seating/seat-grid-viewport";
import { displaySeatNumber, formatSeatLabel } from "@/shared/seat-label";
import {
  beginTouchPaintGesture,
  endTouchPaintGesture,
  moveTouchPaintGesture,
  type TouchPaintGesture,
} from "./event-seat-pointer-gesture";

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
    () =>
      hall?.seats
        .filter((seat) => seat.kind === "seat" && seat.selectable)
        .map((seat) => seat.id) ?? [],
    [hall],
  );
  const [available, setAvailable] = useState(
    () => new Set(initialAvailableSeatIds ?? defaultSeatIds),
  );
  const [changeSource, setChangeSource] = useState<
    "manual" | "half_lock" | "half_unlock" | "half_switch"
  >("manual");
  const [changedSide, setChangedSide] = useState<SeatHalf | "">("");
  const locked = useMemo(() => new Set(lockedSeatIds), [lockedSeatIds]);
  const editableSeatIds = useMemo(
    () =>
      new Set(
        hall?.seats
          .filter((seat) => seat.kind === "seat" && seat.selectable && !locked.has(seat.id))
          .map((seat) => seat.id) ?? [],
      ),
    [hall, locked],
  );
  const painting = useRef<boolean | null>(null);
  const touchGesture = useRef<TouchPaintGesture>({ mode: "idle" });
  const pinching = useRef(false);
  const touchSnapshot = useRef<{
    available: Set<string>;
    changeSource: typeof changeSource;
    changedSide: typeof changedSide;
  } | null>(null);
  const columns = Math.max(...(hall?.seats.map((seat) => seat.columnIndex) ?? [0])) + 1;
  const rowIndexes = [...new Set(hall?.seats.map((seat) => seat.rowIndex) ?? [])];
  const positionedSeats = useMemo(
    () => hall?.seats.map((seat) => ({ ...seat, templateSelectable: seat.selectable })) ?? [],
    [hall],
  );
  const activeLockedHalf = detectLockedSeatHalf(
    positionedSeats,
    available,
    locked,
    centerAfterColumn,
  );

  function markManualChange() {
    setChangeSource("manual");
    setChangedSide("");
  }

  function paint(seatId: string) {
    if (painting.current === null || locked.has(seatId)) return;
    const shouldOpen = painting.current;
    markManualChange();
    setAvailable((current) => {
      const next = new Set(current);
      if (shouldOpen) next.add(seatId);
      else next.delete(seatId);
      return next;
    });
  }

  function seatIdAt(clientX: number, clientY: number) {
    return (
      document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>("[data-event-seat-id]")
        ?.dataset.eventSeatId ?? null
    );
  }

  function handleTouchCountChange(count: number) {
    if (count >= 2) {
      pinching.current = true;
      painting.current = null;
      touchGesture.current = { mode: "multiple", pointerIds: [] };
      if (touchSnapshot.current) {
        setAvailable(new Set(touchSnapshot.current.available));
        setChangeSource(touchSnapshot.current.changeSource);
        setChangedSide(touchSnapshot.current.changedSide);
      }
    } else if (count === 0) {
      pinching.current = false;
      touchGesture.current = { mode: "idle" };
      touchSnapshot.current = null;
    }
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
          <select
            name="hallId"
            value={hall.id}
            onChange={(event) => {
              const nextHallId = event.target.value;
              const nextHall = halls.find((item) => item.id === nextHallId);
              setHallId(nextHallId);
              setAvailable(
                new Set(
                  nextHall?.seats
                    .filter((seat) => seat.kind === "seat" && seat.selectable)
                    .map((seat) => seat.id) ?? [],
                ),
              );
              markManualChange();
            }}
          >
            {halls.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {enableHalfLockControls ? (
        <div className="half-lock-controls">
          <div>
            <strong>快速锁定半场</strong>
            <p className="muted">
              左右半场互斥；再次点击当前启用的按钮可取消锁定。调整完成后点击下方保存按钮才会生效。
            </p>
          </div>
          <div className="header-actions">
            <button
              className={`button ${activeLockedHalf === "left" ? "primary" : ""}`}
              aria-pressed={activeLockedHalf === "left"}
              type="button"
              onClick={() => toggleHalf("left")}
            >
              {activeLockedHalf === "left" ? "取消锁定左半场" : "锁定左半场"}
            </button>
            <button
              className={`button ${activeLockedHalf === "right" ? "primary" : ""}`}
              aria-pressed={activeLockedHalf === "right"}
              type="button"
              onClick={() => toggleHalf("right")}
            >
              {activeLockedHalf === "right" ? "取消锁定右半场" : "锁定右半场"}
            </button>
          </div>
        </div>
      ) : null}
      <p className="muted">按住鼠标或手指拖动可连续选择。绿色座位开放，灰色座位不开放。</p>
      <div className="tool-row">
        <button
          type="button"
          onClick={() => {
            setAvailable(new Set(defaultSeatIds));
            markManualChange();
          }}
        >
          全部开放
        </button>
        <button
          type="button"
          onClick={() => {
            setAvailable(new Set(lockedSeatIds));
            markManualChange();
          }}
        >
          全部关闭
        </button>
        <span>{available.size} 个座位开放</span>
      </div>
      <SeatGridViewport
        ariaLabel="活动座位开放区域"
        className="editor-grid-viewport"
        onTouchCountChange={handleTouchCountChange}
      >
        <div
          className="seat-grid event-seat-grid"
          style={{ gridTemplateColumns: `max-content repeat(${columns}, 36px)` }}
          onPointerDown={(event) => {
            const candidateSeatId = seatIdAt(event.clientX, event.clientY);
            const seatId =
              candidateSeatId && editableSeatIds.has(candidateSeatId) ? candidateSeatId : null;
            if (event.pointerType !== "touch") {
              if (!seatId) return;
              event.preventDefault();
              painting.current = !available.has(seatId);
              paint(seatId);
              return;
            }

            event.currentTarget.setPointerCapture(event.pointerId);
            const previousGesture = touchGesture.current;
            if (previousGesture.mode === "idle")
              touchSnapshot.current = { available: new Set(available), changeSource, changedSide };
            const transition = beginTouchPaintGesture(
              previousGesture,
              event.pointerId,
              event.clientX,
              event.clientY,
              seatId,
            );
            touchGesture.current = transition.gesture;
            if (transition.action === "cancel") {
              painting.current = null;
              if (touchSnapshot.current) {
                setAvailable(new Set(touchSnapshot.current.available));
                setChangeSource(touchSnapshot.current.changeSource);
                setChangedSide(touchSnapshot.current.changedSide);
              }
            }
          }}
          onPointerMove={(event) => {
            const candidateSeatId = seatIdAt(event.clientX, event.clientY);
            const seatId =
              candidateSeatId && editableSeatIds.has(candidateSeatId) ? candidateSeatId : null;
            if (event.pointerType !== "touch") {
              if (painting.current !== null && seatId) paint(seatId);
              return;
            }
            if (pinching.current) return;

            const transition = moveTouchPaintGesture(
              touchGesture.current,
              event.pointerId,
              event.clientX,
              event.clientY,
            );
            touchGesture.current = transition.gesture;
            if (
              transition.action === "begin" &&
              transition.gesture.mode === "single" &&
              transition.gesture.startSeatId
            ) {
              painting.current = !(
                touchSnapshot.current?.available.has(transition.gesture.startSeatId) ?? false
              );
              paint(transition.gesture.startSeatId);
            }
            if ((transition.action === "begin" || transition.action === "continue") && seatId)
              paint(seatId);
          }}
          onPointerUp={(event) => {
            if (event.pointerType !== "touch") {
              painting.current = null;
              return;
            }
            if (pinching.current) return;
            const previousGesture = touchGesture.current;
            const transition = endTouchPaintGesture(previousGesture, event.pointerId);
            touchGesture.current = transition.gesture;
            if (
              transition.action === "tap" &&
              previousGesture.mode === "single" &&
              previousGesture.startSeatId &&
              !locked.has(previousGesture.startSeatId)
            ) {
              painting.current = !(
                touchSnapshot.current?.available.has(previousGesture.startSeatId) ?? false
              );
              paint(previousGesture.startSeatId);
            }
            if (transition.gesture.mode === "idle") touchSnapshot.current = null;
            painting.current = null;
          }}
          onPointerCancel={(event) => {
            if (event.pointerType === "touch") {
              const transition = endTouchPaintGesture(touchGesture.current, event.pointerId);
              touchGesture.current = transition.gesture;
              if (transition.gesture.mode === "idle") touchSnapshot.current = null;
            }
            painting.current = null;
          }}
          onPointerLeave={(event) => {
            if (event.pointerType === "mouse") painting.current = null;
          }}
        >
          {rowIndexes.map((rowIndex) => (
            <div
              className="seat-coordinate-row"
              style={{
                gridColumn: `1 / span ${columns + 1}`,
                gridTemplateColumns: `max-content repeat(${columns}, 36px)`,
              }}
              key={`row:${rowIndex}`}
            >
              <span className="seat-coordinate row">
                {hall.seats.find((seat) => seat.rowIndex === rowIndex)?.rowLabel ?? rowIndex + 1}
              </span>
              {hall.seats
                .filter((seat) => seat.rowIndex === rowIndex)
                .map((seat) => {
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
                      onClick={(event) => {
                        if (event.detail !== 0 || structural || isLocked) return;
                        painting.current = !isAvailable;
                        paint(seat.id);
                        painting.current = null;
                      }}
                    >
                      {seat.kind === "seat" ? displaySeatNumber(seat.columnLabel) : ""}
                    </button>
                  );
                })}
            </div>
          ))}
        </div>
      </SeatGridViewport>
      <input type="hidden" name="availableSeatIds" value={JSON.stringify([...available])} />
      <input type="hidden" name="changeSource" value={changeSource} />
      {changedSide ? <input type="hidden" name="side" value={changedSide} /> : null}
    </fieldset>
  );
}

"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  detectLockedSeatHalf,
  quickOpenSeatRectangle,
  toggleSelectedSeatAvailability,
  toggleSeatHalfLock,
  type SeatHalf,
} from "@/server/domain/event-seat-availability";
import { SeatGridViewport } from "@/features/seating/seat-grid-viewport";
import { NumericInput } from "@/features/forms/numeric-input";
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
  cinemaId: string;
  cinemaName: string;
  hallName: string;
  seats: EventSeat[];
};

const EMPTY_SEAT_IDS: string[] = [];
type Rectangle = { left: number; top: number; right: number; bottom: number };
type SeatRectangle = Rectangle & { id: string; eligible: boolean };

export function gridPointerPosition(
  clientX: number,
  clientY: number,
  gridRect: Rectangle,
  gridWidth: number,
  gridHeight: number,
) {
  return {
    x: ((clientX - gridRect.left) * gridWidth) / (gridRect.right - gridRect.left),
    y: ((clientY - gridRect.top) * gridHeight) / (gridRect.bottom - gridRect.top),
  };
}

export function seatsIntersectingRectangle(selection: Rectangle, seats: SeatRectangle[]): string[] {
  return seats
    .filter(
      (seat) =>
        seat.eligible &&
        seat.right >= selection.left &&
        seat.left <= selection.right &&
        seat.bottom >= selection.top &&
        seat.top <= selection.bottom,
    )
    .map((seat) => seat.id);
}

export function EventSeatEditor({
  halls,
  initialHallId,
  initialAvailableSeatIds,
  lockedSeatIds = EMPTY_SEAT_IDS,
  includeHallSelect = false,
  enableHalfLockControls = false,
  centerAfterColumn = null,
  planningToolsEnabled = false,
}: {
  halls: EventHallLayout[];
  initialHallId: string;
  initialAvailableSeatIds?: string[];
  lockedSeatIds?: string[];
  includeHallSelect?: boolean;
  enableHalfLockControls?: boolean;
  centerAfterColumn?: number | null;
  planningToolsEnabled?: boolean;
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
  const hallGroups = useMemo(() => {
    const groups: Array<{ id: string; name: string; halls: EventHallLayout[] }> = [];
    for (const item of halls) {
      const group = groups.find((candidate) => candidate.id === item.cinemaId);
      if (group) group.halls.push(item);
      else groups.push({ id: item.cinemaId, name: item.cinemaName, halls: [item] });
    }
    return groups;
  }, [halls]);
  const [interactionMode, setInteractionMode] = useState<"navigate" | "edit" | "rectangle">(
    "navigate",
  );
  const [changeSource, setChangeSource] = useState<
    | "manual"
    | "half_lock"
    | "half_unlock"
    | "half_switch"
    | "quick_count"
    | "rectangle_toggle"
  >("manual");
  const [changedSide, setChangedSide] = useState<SeatHalf | "">("");
  const locked = useMemo(() => new Set(lockedSeatIds), [lockedSeatIds]);
  const painting = useRef<boolean | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const rectangleStart = useRef<{ x: number; y: number } | null>(null);
  const [rectangle, setRectangle] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const [quickOpenVisible, setQuickOpenVisible] = useState(false);
  const [quickOpenCount, setQuickOpenCount] = useState(1);
  const [quickOpenValid, setQuickOpenValid] = useState(true);
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

  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        rectangleStart.current = null;
        setRectangle(null);
      }
    };
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, []);

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

  function localPointer(event: ReactPointerEvent<HTMLDivElement>) {
    const grid = gridRef.current;
    if (!grid) return null;
    const rect = grid.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return gridPointerPosition(
      event.clientX,
      event.clientY,
      { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
      grid.offsetWidth,
      grid.offsetHeight,
    );
  }

  function updateRectangle(point: { x: number; y: number }) {
    const start = rectangleStart.current;
    if (!start) return;
    setRectangle({
      left: Math.min(start.x, point.x),
      top: Math.min(start.y, point.y),
      width: Math.abs(point.x - start.x),
      height: Math.abs(point.y - start.y),
    });
  }

  function beginRectangle(event: ReactPointerEvent<HTMLDivElement>) {
    if (interactionMode !== "rectangle") return;
    const point = localPointer(event);
    if (!point) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    rectangleStart.current = point;
    setRectangle({ left: point.x, top: point.y, width: 0, height: 0 });
  }

  function finishRectangle(event: ReactPointerEvent<HTMLDivElement>) {
    const grid = gridRef.current;
    const start = rectangleStart.current;
    if (interactionMode !== "rectangle" || !grid || !start) return;
    const point = localPointer(event);
    rectangleStart.current = null;
    setRectangle(null);
    if (!point) return;
    const selection = {
      left: Math.min(start.x, point.x),
      top: Math.min(start.y, point.y),
      right: Math.max(start.x, point.x),
      bottom: Math.max(start.y, point.y),
    };
    const gridRect = grid.getBoundingClientRect();
    const scaleX = gridRect.width / grid.offsetWidth;
    const scaleY = gridRect.height / grid.offsetHeight;
    const seatRectangles = [...grid.querySelectorAll<HTMLElement>("[data-event-seat-id]")].flatMap(
      (seat): SeatRectangle[] => {
        const rect = seat.getBoundingClientRect();
        const left = (rect.left - gridRect.left) / scaleX;
        const top = (rect.top - gridRect.top) / scaleY;
        const right = left + rect.width / scaleX;
        const bottom = top + rect.height / scaleY;
        return seat.dataset.eventSeatId
          ? [
              {
                id: seat.dataset.eventSeatId,
                eligible: seat.dataset.eventSeatEligible === "true",
                left,
                top,
                right,
                bottom,
              },
            ]
          : [];
      },
    );
    const selectedIds = seatsIntersectingRectangle(selection, seatRectangles);
    if (!selectedIds.length) return;
    setAvailable((current) => toggleSelectedSeatAvailability(current, selectedIds, locked));
    setChangeSource("rectangle_toggle");
    setChangedSide("");
  }

  function applyQuickOpen() {
    if (!quickOpenValid) return;
    const result = quickOpenSeatRectangle(
      hall!.seats.map((seat) => ({
        ...seat,
        templateSelectable: seat.kind === "seat" && seat.selectable,
      })),
      quickOpenCount,
      centerAfterColumn,
    );
    setAvailable(new Set([...result.availableSeatIds, ...lockedSeatIds]));
    setChangeSource("quick_count");
    setChangedSide("");
    setQuickOpenVisible(false);
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
            {hallGroups.map((group) => (
              <optgroup key={group.id} label={group.name}>
                {group.halls.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.hallName}
                  </option>
                ))}
              </optgroup>
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
      <p className="muted">绿色座位开放，灰色座位不开放。</p>
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
        {planningToolsEnabled ? (
          <button
            type="button"
            disabled={defaultSeatIds.length === 0}
            onClick={() => {
              setQuickOpenCount(Math.min(Math.max(1, available.size), defaultSeatIds.length));
              setQuickOpenValid(true);
              setQuickOpenVisible(true);
            }}
          >
            按数量开放
          </button>
        ) : null}
      </div>
      <div className="tool-row" role="toolbar" aria-label="活动座位网格操作模式">
        <strong>网格操作</strong>
        <button
          className={interactionMode === "navigate" ? "active" : ""}
          aria-pressed={interactionMode === "navigate"}
          type="button"
          onClick={() => {
            painting.current = null;
            rectangleStart.current = null;
            setRectangle(null);
            setInteractionMode("navigate");
          }}
        >
          无修改
        </button>
        <button
          className={interactionMode === "edit" ? "active" : ""}
          aria-pressed={interactionMode === "edit"}
          type="button"
          onClick={() => {
            rectangleStart.current = null;
            setRectangle(null);
            setInteractionMode("edit");
          }}
        >
          调整可选区域
        </button>
        {planningToolsEnabled ? (
          <button
            className={interactionMode === "rectangle" ? "active" : ""}
            aria-pressed={interactionMode === "rectangle"}
            type="button"
            onClick={() => {
              painting.current = null;
              setInteractionMode("rectangle");
            }}
          >
            框选模式
          </button>
        ) : null}
      </div>
      <SeatGridViewport
        ariaLabel="活动座位开放区域"
        className="editor-grid-viewport"
        gesturesEnabled={interactionMode === "navigate"}
        interactionHint={
          <p className="grid-interaction-hint muted" role="status" aria-live="polite">
            {interactionMode === "navigate"
              ? "当前为“无修改”模式：单指拖动可移动网格，双指可缩放；也可使用上方缩放按钮。"
              : interactionMode === "rectangle"
                ? "当前为“框选模式”：在座位区域拖出矩形，框内可选且未锁定的座位会逐个切换开放、关闭状态，框外不变；按 Esc 可取消未完成框选。"
                : "当前为“调整可选区域”模式：点击或拖动可开放、关闭座位；如需移动或双指缩放，请切换到“无修改”。"}
          </p>
        }
      >
        <div
          ref={gridRef}
          className="seat-grid event-seat-grid"
          style={{ gridTemplateColumns: `max-content repeat(${columns}, 36px)` }}
          onPointerMove={(event) => {
            if (interactionMode === "rectangle") {
              const point = localPointer(event);
              if (point) updateRectangle(point);
              return;
            }
            if (painting.current === null) return;
            const target = document
              .elementFromPoint(event.clientX, event.clientY)
              ?.closest<HTMLElement>("[data-event-seat-id]");
            if (target?.dataset.eventSeatId) paint(target.dataset.eventSeatId);
          }}
          onPointerDownCapture={beginRectangle}
          onPointerUp={(event) => {
            if (interactionMode === "rectangle") return finishRectangle(event);
            painting.current = null;
          }}
          onPointerCancel={() => {
            rectangleStart.current = null;
            setRectangle(null);
            painting.current = null;
          }}
          onPointerLeave={(event) => {
            if (event.pointerType === "mouse") painting.current = null;
          }}
        >
          {rectangle ? (
            <span className="seat-selection-rectangle" style={rectangle} aria-hidden="true" />
          ) : null}
          {rowIndexes.map((rowIndex) => (
            <div
              className="seat-coordinate-row"
              style={{
                gridColumn: `1 / span ${columns + 1}`,
                gridTemplateColumns: `max-content repeat(${columns}, 36px)`,
              }}
              key={`row:${rowIndex}`}
            >
              <span
                className="seat-coordinate row"
                data-seat-row-coordinate={
                  hall.seats.find((seat) => seat.rowIndex === rowIndex)?.rowLabel ?? rowIndex + 1
                }
                data-seat-row-key={`event:${rowIndex}`}
              >
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
                      data-event-seat-eligible={structural || isLocked ? "false" : "true"}
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
                        if (
                          interactionMode !== "edit" ||
                          event.detail !== 0 ||
                          structural ||
                          isLocked
                        )
                          return;
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
      {quickOpenVisible ? (
        <div
          className="lottery-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-open-title"
        >
          <div className="lottery-modal quick-open-modal">
            <p className="eyebrow">快速规划</p>
            <h2 id="quick-open-title">按数量开放座位</h2>
            <p>将从最后一排中间开始，按约 4:3 的矩形向上开放；其他座位会关闭。</p>
            <label>
              想开放的座位数量
              <NumericInput
                min={1}
                max={defaultSeatIds.length}
                step={1}
                defaultValue={quickOpenCount}
                onValueChange={setQuickOpenCount}
                onValidityChange={setQuickOpenValid}
              />
            </label>
            <small>最多可开放 {defaultSeatIds.length} 个模板可选座位。</small>
            <div className="header-actions">
              <button className="button" type="button" onClick={() => setQuickOpenVisible(false)}>
                取消
              </button>
              <button
                className="button primary"
                type="button"
                disabled={!quickOpenValid}
                onClick={applyQuickOpen}
              >
                确认并预览
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <input type="hidden" name="availableSeatIds" value={JSON.stringify([...available])} />
      <input type="hidden" name="changeSource" value={changeSource} />
      {changedSide ? <input type="hidden" name="side" value={changedSide} /> : null}
    </fieldset>
  );
}

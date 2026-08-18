"use client";

import { useMemo, useRef, useState } from "react";
import { NumericInput } from "@/features/forms/numeric-input";
import { SelectField } from "@/features/forms/select-field";
import { SeatGridViewport } from "@/features/seating/seat-grid-viewport";
import { generateSeatLabels, type LabelDirection, type LabelStyle } from "./seat-labels";
import { displaySeatNumber, formatSeatLabel } from "@/shared/seat-label";
import { generateSeatNumbers, nextSeatNumber } from "./seat-numbering";

type LayoutTool = "seat" | "blocked" | "golden" | "aisle" | "empty";
export type Tool = "navigate" | LayoutTool | "number" | "clear-number";
const TOOL_LABELS = {
  seat: "可选",
  blocked: "不可选",
  golden: "黄金区",
  aisle: "过道",
  empty: "空白",
  number: "填充座位号",
  "clear-number": "清除座位号",
} as const;
export type LayoutCell = {
  rowIndex: number;
  columnIndex: number;
  rowLabel: string;
  columnLabel: string;
  kind: "seat" | "aisle" | "empty";
  selectable: boolean;
  golden: boolean;
};
export type EditableHallLayout = {
  rows: number;
  columns: number;
  centerAfterColumn: number | null;
  cells: LayoutCell[];
};

export function toggleSeatLayoutTool(current: Tool, next: "number" | "clear-number"): Tool {
  return current === next ? "navigate" : next;
}

function layoutTool(cell: LayoutCell): LayoutTool {
  if (cell.kind === "aisle" || cell.kind === "empty") return cell.kind;
  if (cell.golden) return "golden";
  return cell.selectable ? "seat" : "blocked";
}

export function SeatLayoutEditor({ initialLayout }: { initialLayout?: EditableHallLayout }) {
  const [rowLabels, setRowLabels] = useState(() =>
    initialLayout
      ? Array.from(
          { length: initialLayout.rows },
          (_, rowIndex) =>
            initialLayout.cells.find((cell) => cell.rowIndex === rowIndex)?.rowLabel ??
            String(rowIndex + 1),
        )
      : generateSeatLabels(8, "letters", "ascending"),
  );
  const [columns, setColumns] = useState(initialLayout?.columns ?? 12);
  const [seatNumbers, setSeatNumbers] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      initialLayout?.cells.map((cell) => [
        `${cell.rowIndex}:${cell.columnIndex}`,
        cell.columnLabel,
      ]) ?? [],
    ),
  );
  const [rowStyle, setRowStyle] = useState<LabelStyle>("letters");
  const [rowDirection, setRowDirection] = useState<LabelDirection>("ascending");
  const [numberStyle, setNumberStyle] = useState<LabelStyle>("numbers");
  const [numberDirection, setNumberDirection] = useState<LabelDirection>("ascending");
  const [tool, setTool] = useState<Tool>("navigate");
  const [overrides, setOverrides] = useState<Record<string, LayoutTool>>(() =>
    Object.fromEntries(
      initialLayout?.cells.map((cell) => [
        `${cell.rowIndex}:${cell.columnIndex}`,
        layoutTool(cell),
      ]) ?? [],
    ),
  );
  const [center, setCenter] = useState(initialLayout?.centerAfterColumn ?? 6);
  const painting = useRef(false);
  const painted = useRef(new Set<string>());
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cells = useMemo(
    () =>
      rowLabels.flatMap((rowLabel, rowIndex) =>
        Array.from({ length: columns }, (_, columnIndex): LayoutCell => {
          const key = `${rowIndex}:${columnIndex}`;
          const mode = overrides[`${rowIndex}:${columnIndex}`] ?? "seat";
          return {
            rowIndex,
            columnIndex,
            rowLabel,
            columnLabel: seatNumbers[key] ?? "",
            kind: mode === "aisle" || mode === "empty" ? mode : "seat",
            selectable: mode !== "blocked" && mode !== "aisle" && mode !== "empty",
            golden: mode === "golden",
          };
        }),
      ),
    [columns, overrides, rowLabels, seatNumbers],
  );
  const payload = JSON.stringify({
    rows: rowLabels.length,
    columns,
    centerAfterColumn: center,
    cells,
  });

  function resizeRows(value: number) {
    setRowLabels((old) =>
      Array.from(
        { length: value },
        (_, i) => old[i] ?? generateSeatLabels(value, rowStyle, rowDirection)[i]!,
      ),
    );
  }
  function resizeColumns(value: number) {
    setColumns(value);
  }

  function generateNumbers() {
    setSeatNumbers(generateSeatNumbers(cells, numberStyle, numberDirection));
  }

  function editSeatNumber(rowIndex: number, columnIndex: number) {
    const key = `${rowIndex}:${columnIndex}`;
    const current = seatNumbers[key] ?? "";
    const value = window.prompt("编辑该座位号（留空可清除）", current);
    if (value === null) return;
    setSeatNumbers((old) => ({ ...old, [key]: value.trim().slice(0, 12) }));
  }

  function applyTool(rowIndex: number, columnIndex: number) {
    if (tool === "navigate") return;
    const key = `${rowIndex}:${columnIndex}`;
    if (painted.current.has(key)) return;
    painted.current.add(key);
    const layoutMode = overrides[key] ?? "seat";
    if (
      (tool === "number" || tool === "clear-number") &&
      (layoutMode === "aisle" || layoutMode === "empty")
    )
      return;
    if (tool === "number") {
      setSeatNumbers((old) => {
        if (old[key]) return old;
        const rowNumbers = Array.from(
          { length: columns },
          (_, index) => old[`${rowIndex}:${index}`] ?? "",
        );
        return { ...old, [key]: nextSeatNumber(rowNumbers, numberStyle) };
      });
      return;
    }
    if (tool === "clear-number") {
      setSeatNumbers((old) => ({ ...old, [key]: "" }));
      return;
    }
    setOverrides((old) => ({ ...old, [key]: tool }));
  }

  function stopPainting() {
    painting.current = false;
    painted.current.clear();
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  }

  function toggleEmptyRow(rowIndex: number) {
    const isEmptyRow = Array.from(
      { length: columns },
      (_, columnIndex) => overrides[`${rowIndex}:${columnIndex}`] === "empty",
    ).every(Boolean);
    setOverrides((old) => {
      const next = { ...old };
      for (let columnIndex = 0; columnIndex < columns; columnIndex += 1)
        next[`${rowIndex}:${columnIndex}`] = isEmptyRow ? "seat" : "empty";
      return next;
    });
  }
  return (
    <fieldset className="layout-editor">
      <legend>座位布局</legend>
      <div className="layout-controls">
        <label>
          行数
          <NumericInput min={1} max={50} value={rowLabels.length} onValueChange={resizeRows} />
        </label>
        <label>
          列数
          <NumericInput min={1} max={50} value={columns} onValueChange={resizeColumns} />
        </label>
        <label>
          中线位于第几列后
          <NumericInput
            min={1}
            max={columns}
            value={center + 1}
            onValueChange={(value) => setCenter(value - 1)}
          />
        </label>
      </div>
      <div className="label-presets">
        <div className="label-preset">
          <strong>快速生成行名称</strong>
          <div className="label-preset-controls">
            <SelectField
              ariaLabel="行名称格式"
              value={rowStyle}
              onValueChange={(value) => setRowStyle(value as LabelStyle)}
              options={[
                { id: "letters", label: "字母" },
                { id: "numbers", label: "数字" },
              ]}
            />
            <SelectField
              ariaLabel="行名称顺序"
              value={rowDirection}
              onValueChange={(value) => setRowDirection(value as LabelDirection)}
              options={[
                { id: "ascending", label: "正序" },
                { id: "descending", label: "倒序" },
              ]}
            />
            <button
              type="button"
              onClick={() =>
                setRowLabels(generateSeatLabels(rowLabels.length, rowStyle, rowDirection))
              }
            >
              生成
            </button>
          </div>
        </div>
        <div className="label-preset">
          <div className="label-preset-heading">
            <strong>横排座位号</strong>
            <span>自动生成或按顺序手动填充</span>
          </div>
          <div className="label-preset-controls">
            <SelectField
              ariaLabel="横排座位号类型"
              value={numberStyle}
              onValueChange={(value) => setNumberStyle(value as LabelStyle)}
              options={[
                { id: "numbers", label: "数字" },
                { id: "letters", label: "字母" },
              ]}
            />
            <SelectField
              ariaLabel="横排座位号顺序"
              value={numberDirection}
              onValueChange={(value) => setNumberDirection(value as LabelDirection)}
              options={[
                { id: "ascending", label: "正序" },
                { id: "descending", label: "倒序" },
              ]}
            />
            <button type="button" onClick={generateNumbers}>
              自动生成
            </button>
          </div>
          <div className="label-preset-actions">
            <button
              className={tool === "number" ? "active" : ""}
              aria-pressed={tool === "number"}
              type="button"
              onClick={() => setTool((current) => toggleSeatLayoutTool(current, "number"))}
            >
              {tool === "number" ? "停止填充" : "开始填充"}
            </button>
            <button
              className={tool === "clear-number" ? "active" : ""}
              aria-pressed={tool === "clear-number"}
              type="button"
              onClick={() => setTool((current) => toggleSeatLayoutTool(current, "clear-number"))}
            >
              {tool === "clear-number" ? "停止清除" : "清除座位号"}
            </button>
          </div>
        </div>
      </div>
      <div className="label-editor">
        <div>
          <strong>行名称</strong>
          {rowLabels.map((label, i) => (
            <input
              aria-label={`第${i + 1}行名称`}
              key={i}
              value={label}
              maxLength={12}
              onChange={(e) =>
                setRowLabels((old) =>
                  old.map((item, index) => (index === i ? e.target.value : item)),
                )
              }
            />
          ))}
        </div>
        <div>
          <strong>座位号维护</strong>
          <span className="muted">请在下方座位图中按实际顺序填充，或右键/长按单独编辑。</span>
        </div>
      </div>
      <div className="tool-row" role="toolbar" aria-label="布局绘制工具">
        <strong>网格类型</strong>
        <button
          className={tool === "navigate" ? "active" : ""}
          aria-pressed={tool === "navigate"}
          type="button"
          onClick={() => {
            stopPainting();
            setTool("navigate");
          }}
        >
          无修改
        </button>
        {(["seat", "blocked", "golden", "aisle", "empty"] as const).map((item) => (
          <button
            className={tool === item ? "active" : ""}
            aria-pressed={tool === item}
            type="button"
            key={item}
            onClick={() => setTool(item)}
          >
            {TOOL_LABELS[item]}
          </button>
        ))}
      </div>
      <SeatGridViewport
        ariaLabel="座位布局绘制区域"
        className="editor-grid-viewport"
        gesturesEnabled={tool === "navigate"}
        interactionHint={
          <p className="grid-interaction-hint muted" role="status" aria-live="polite">
            {tool === "navigate"
              ? "当前为“无修改”模式：单指拖动可移动网格，双指可缩放；也可使用上方缩放按钮。"
              : `当前为“${TOOL_LABELS[tool]}”模式：点击或拖动会修改座位；如需移动或双指缩放，请切换到“无修改”。`}
          </p>
        }
      >
        <div
          className="seat-grid seat-grid-with-coordinates"
          style={{ gridTemplateColumns: `max-content repeat(${columns}, 36px)` }}
          onPointerMove={(event) => {
            if (!painting.current) return;
            if (longPressTimer.current) clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
            const target = document
              .elementFromPoint(event.clientX, event.clientY)
              ?.closest<HTMLElement>("[data-layout-seat]");
            if (target?.dataset.rowIndex && target.dataset.columnIndex)
              applyTool(Number(target.dataset.rowIndex), Number(target.dataset.columnIndex));
          }}
          onPointerUp={stopPainting}
          onPointerCancel={stopPainting}
          onPointerLeave={(event) => {
            if (event.pointerType === "mouse") stopPainting();
          }}
        >
          {rowLabels.map((rowLabel, rowIndex) => {
            const isEmptyRow = Array.from(
              { length: columns },
              (_, columnIndex) => overrides[`${rowIndex}:${columnIndex}`] === "empty",
            ).every(Boolean);
            return (
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
                  data-seat-row-coordinate={rowLabel}
                  data-seat-row-key={`layout:${rowIndex}`}
                >
                  <span>{rowLabel}</span>
                  <button
                    className="empty-row-toggle"
                    type="button"
                    aria-pressed={isEmptyRow}
                    aria-disabled={tool === "navigate" || undefined}
                    tabIndex={tool === "navigate" ? -1 : undefined}
                    onClick={() => {
                      if (tool !== "navigate") toggleEmptyRow(rowIndex);
                    }}
                  >
                    {isEmptyRow ? "恢复座位" : "设为空行"}
                  </button>
                </span>
                {cells
                  .filter((cell) => cell.rowIndex === rowIndex)
                  .map((cell) => {
                    const mode = overrides[`${cell.rowIndex}:${cell.columnIndex}`] ?? "seat";
                    return (
                      <button
                        title={formatSeatLabel(cell.rowLabel, cell.columnLabel)}
                        aria-label={`${formatSeatLabel(cell.rowLabel, cell.columnLabel)}：${mode}`}
                        aria-disabled={tool === "navigate" || undefined}
                        tabIndex={tool === "navigate" ? -1 : undefined}
                        className={`editor-seat ${mode} ${center === cell.columnIndex ? "center-divider" : ""}`}
                        type="button"
                        key={`${cell.rowIndex}:${cell.columnIndex}`}
                        data-layout-seat
                        data-row-index={cell.rowIndex}
                        data-column-index={cell.columnIndex}
                        onContextMenu={(event) => {
                          if (tool === "navigate") return;
                          event.preventDefault();
                          if (cell.kind === "seat") editSeatNumber(cell.rowIndex, cell.columnIndex);
                        }}
                        onPointerDown={(event) => {
                          if (tool === "navigate" || event.button === 2) return;
                          event.preventDefault();
                          painting.current = true;
                          painted.current.clear();
                          applyTool(cell.rowIndex, cell.columnIndex);
                          if (cell.kind === "seat" && cell.columnLabel)
                            longPressTimer.current = setTimeout(() => {
                              stopPainting();
                              editSeatNumber(cell.rowIndex, cell.columnIndex);
                            }, 550);
                        }}
                        onPointerUp={stopPainting}
                        onClick={(event) => {
                          if (tool === "navigate" || event.detail !== 0) return;
                          painted.current.clear();
                          applyTool(cell.rowIndex, cell.columnIndex);
                          painted.current.clear();
                        }}
                      >
                        {cell.kind === "seat" ? displaySeatNumber(cell.columnLabel) : ""}
                      </button>
                    );
                  })}
              </div>
            );
          })}
        </div>
      </SeatGridViewport>
      <div className="layout-help">
        <strong>横排座位号说明</strong>
        <p>
          每排默认不编号。选择数字或字母后点击“开始填充”，按钮高亮表示功能已启用，再次点击可停止；随后按实际顺序点击或拖过座位，跨过空位后会接着上次的号码继续。“清除座位号”同样会在启用时高亮。清除中间某个号码不会改变其他号码，只有末尾号码被清除后，下次才从当前最后一个号码续编。右键单击或长按已有座位号可单独编辑。
        </p>
      </div>
      <input type="hidden" name="layout" value={payload} />
    </fieldset>
  );
}

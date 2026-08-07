"use client";

import { useMemo, useRef, useState } from "react";
import { NumericInput } from "@/features/forms/numeric-input";
import { generateSeatLabels, type LabelDirection, type LabelStyle } from "./seat-labels";
import { displaySeatNumber, nextSeatNumber } from "./seat-numbering";

type LayoutTool = "seat" | "blocked" | "golden" | "aisle" | "empty";
type Tool = LayoutTool | "number" | "clear-number";
type Cell = { rowIndex: number; columnIndex: number; rowLabel: string; columnLabel: string; kind: "seat" | "aisle" | "empty"; selectable: boolean; golden: boolean };

export function SeatLayoutEditor() {
  const [rowLabels, setRowLabels] = useState(() => generateSeatLabels(8, "letters", "ascending"));
  const [columns, setColumns] = useState(12);
  const [seatNumbers, setSeatNumbers] = useState<Record<string, string>>({});
  const [rowStyle, setRowStyle] = useState<LabelStyle>("letters");
  const [rowDirection, setRowDirection] = useState<LabelDirection>("ascending");
  const [numberStyle, setNumberStyle] = useState<LabelStyle>("numbers");
  const [tool, setTool] = useState<Tool>("seat");
  const [overrides, setOverrides] = useState<Record<string, LayoutTool>>({});
  const [center, setCenter] = useState(6);
  const painting = useRef(false);
  const painted = useRef(new Set<string>());
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cells = useMemo(() => rowLabels.flatMap((rowLabel, rowIndex) => Array.from({ length: columns }, (_, columnIndex): Cell => {
    const key = `${rowIndex}:${columnIndex}`;
    const mode = overrides[`${rowIndex}:${columnIndex}`] ?? "seat";
    return { rowIndex, columnIndex, rowLabel, columnLabel: seatNumbers[key] ?? "", kind: mode === "aisle" || mode === "empty" ? mode : "seat", selectable: mode !== "blocked" && mode !== "aisle" && mode !== "empty", golden: mode === "golden" };
  })), [columns, overrides, rowLabels, seatNumbers]);
  const payload = JSON.stringify({ rows: rowLabels.length, columns, centerAfterColumn: center, cells });

  function resizeRows(value: number) { setRowLabels((old) => Array.from({ length: value }, (_, i) => old[i] ?? generateSeatLabels(value, rowStyle, rowDirection)[i]!)); }
  function resizeColumns(value: number) { setColumns(value); }

  function editSeatNumber(rowIndex: number, columnIndex: number) {
    const key = `${rowIndex}:${columnIndex}`;
    const current = seatNumbers[key] ?? "";
    const value = window.prompt("编辑该座位号（留空可清除）", current);
    if (value === null) return;
    setSeatNumbers((old) => ({ ...old, [key]: value.trim().slice(0, 12) }));
  }

  function applyTool(rowIndex: number, columnIndex: number) {
    const key = `${rowIndex}:${columnIndex}`;
    if (painted.current.has(key)) return;
    painted.current.add(key);
    const layoutMode = overrides[key] ?? "seat";
    if ((tool === "number" || tool === "clear-number") && (layoutMode === "aisle" || layoutMode === "empty")) return;
    if (tool === "number") {
      setSeatNumbers((old) => {
        if (old[key]) return old;
        const rowNumbers = Array.from({ length: columns }, (_, index) => old[`${rowIndex}:${index}`] ?? "");
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
    const isEmptyRow = Array.from({ length: columns }, (_, columnIndex) => overrides[`${rowIndex}:${columnIndex}`] === "empty").every(Boolean);
    setOverrides((old) => {
      const next = { ...old };
      for (let columnIndex = 0; columnIndex < columns; columnIndex += 1) next[`${rowIndex}:${columnIndex}`] = isEmptyRow ? "seat" : "empty";
      return next;
    });
  }
  return (
    <fieldset className="layout-editor">
      <legend>座位布局</legend>
      <div className="layout-controls">
        <label>行数<NumericInput min={1} max={50} value={rowLabels.length} onValueChange={resizeRows} /></label>
        <label>列数<NumericInput min={1} max={50} value={columns} onValueChange={resizeColumns} /></label>
        <label>中线位于第几列后<NumericInput min={1} max={columns} value={center + 1} onValueChange={(value) => setCenter(value - 1)} /></label>
      </div>
      <div className="label-presets">
        <div><strong>快速生成行名称</strong><select aria-label="行名称格式" value={rowStyle} onChange={(event) => setRowStyle(event.target.value as LabelStyle)}><option value="letters">字母</option><option value="numbers">数字</option></select><select aria-label="行名称顺序" value={rowDirection} onChange={(event) => setRowDirection(event.target.value as LabelDirection)}><option value="ascending">正序</option><option value="descending">倒序</option></select><button type="button" onClick={() => setRowLabels(generateSeatLabels(rowLabels.length, rowStyle, rowDirection))}>生成</button></div>
        <div><strong>横排座位号类型</strong><select aria-label="横排座位号类型" value={numberStyle} onChange={(event) => setNumberStyle(event.target.value as LabelStyle)}><option value="numbers">数字</option><option value="letters">字母</option></select><button className={tool === "number" ? "active" : ""} aria-pressed={tool === "number"} type="button" onClick={() => setTool((current) => current === "number" ? "seat" : "number")}>{tool === "number" ? "停止填充" : "开始填充"}</button><button className={tool === "clear-number" ? "active" : ""} aria-pressed={tool === "clear-number"} type="button" onClick={() => setTool((current) => current === "clear-number" ? "seat" : "clear-number")}>{tool === "clear-number" ? "停止清除" : "清除座位号"}</button></div>
      </div>
      <div className="label-editor">
        <div><strong>行名称</strong>{rowLabels.map((label, i) => <input aria-label={`第${i + 1}行名称`} key={i} value={label} onChange={(e) => setRowLabels((old) => old.map((item, index) => index === i ? e.target.value : item))} />)}</div>
        <div><strong>座位号维护</strong><span className="muted">请在下方座位图中按实际顺序填充，或右键/长按单独编辑。</span></div>
      </div>
      <div className="tool-row" role="toolbar" aria-label="布局绘制工具">
        {(["seat", "blocked", "golden", "aisle", "empty"] as const).map((item) => <button className={tool === item ? "active" : ""} type="button" key={item} onClick={() => setTool(item)}>{({ seat: "可选", blocked: "不可选", golden: "黄金区", aisle: "过道", empty: "空白" } as const)[item]}</button>)}
      </div>
      <div className="seat-grid seat-grid-with-coordinates" style={{ gridTemplateColumns: `max-content repeat(${columns}, 36px)` }} onPointerMove={(event) => {
        if (!painting.current) return;
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
        const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-layout-seat]");
        if (target?.dataset.rowIndex && target.dataset.columnIndex) applyTool(Number(target.dataset.rowIndex), Number(target.dataset.columnIndex));
      }} onPointerUp={stopPainting} onPointerCancel={stopPainting} onPointerLeave={(event) => { if (event.pointerType === "mouse") stopPainting(); }}>
        {rowLabels.map((rowLabel, rowIndex) => {
          const isEmptyRow = Array.from({ length: columns }, (_, columnIndex) => overrides[`${rowIndex}:${columnIndex}`] === "empty").every(Boolean);
          return <div className="seat-coordinate-row" style={{ gridColumn: `1 / span ${columns + 1}`, gridTemplateColumns: `max-content repeat(${columns}, 36px)` }} key={`row:${rowIndex}`}><span className="seat-coordinate row"><span>{rowLabel}</span><button className="empty-row-toggle" type="button" aria-pressed={isEmptyRow} onClick={() => toggleEmptyRow(rowIndex)}>{isEmptyRow ? "恢复座位" : "设为空行"}</button></span>{cells.filter((cell) => cell.rowIndex === rowIndex).map((cell) => {
          const mode = overrides[`${cell.rowIndex}:${cell.columnIndex}`] ?? "seat";
          return <button title={`${cell.rowLabel}排 ${cell.columnLabel || "未编号"}`} aria-label={`${cell.rowLabel}排${cell.columnLabel || "未编号"}：${mode}`} className={`editor-seat ${mode} ${center === cell.columnIndex ? "center-divider" : ""}`} type="button" key={`${cell.rowIndex}:${cell.columnIndex}`} data-layout-seat data-row-index={cell.rowIndex} data-column-index={cell.columnIndex} onContextMenu={(event) => { event.preventDefault(); if (cell.kind === "seat") editSeatNumber(cell.rowIndex, cell.columnIndex); }} onPointerDown={(event) => {
            if (event.button === 2) return;
            event.preventDefault();
            painting.current = true;
            painted.current.clear();
            applyTool(cell.rowIndex, cell.columnIndex);
            if (cell.kind === "seat" && cell.columnLabel) longPressTimer.current = setTimeout(() => { stopPainting(); editSeatNumber(cell.rowIndex, cell.columnIndex); }, 550);
          }} onPointerUp={stopPainting} onClick={(event) => { if (event.detail !== 0) return; painted.current.clear(); applyTool(cell.rowIndex, cell.columnIndex); painted.current.clear(); }}>{cell.kind === "seat" ? displaySeatNumber(cell.columnLabel) : ""}</button>;
        })}</div>;
        })}
      </div>
      <div className="layout-help"><strong>横排座位号说明</strong><p>每排默认不编号。选择数字或字母后点击“开始填充”，按钮高亮表示功能已启用，再次点击可停止；随后按实际顺序点击或拖过座位，跨过空位后会接着上次的号码继续。“清除座位号”同样会在启用时高亮。清除中间某个号码不会改变其他号码，只有末尾号码被清除后，下次才从当前最后一个号码续编。右键单击或长按已有座位号可单独编辑。</p></div>
      <input type="hidden" name="layout" value={payload} />
    </fieldset>
  );
}

"use client";

import { useMemo, useState } from "react";
import { generateSeatLabels, type LabelDirection, type LabelStyle } from "./seat-labels";

type Tool = "seat" | "blocked" | "golden" | "aisle" | "empty";
type Cell = { rowIndex: number; columnIndex: number; rowLabel: string; columnLabel: string; kind: "seat" | "aisle" | "empty"; selectable: boolean; golden: boolean };

export function SeatLayoutEditor() {
  const [rowLabels, setRowLabels] = useState(() => generateSeatLabels(8, "letters", "ascending"));
  const [columnLabels, setColumnLabels] = useState(() => generateSeatLabels(12, "numbers", "ascending"));
  const [rowStyle, setRowStyle] = useState<LabelStyle>("letters");
  const [rowDirection, setRowDirection] = useState<LabelDirection>("ascending");
  const [columnStyle, setColumnStyle] = useState<LabelStyle>("numbers");
  const [columnDirection, setColumnDirection] = useState<LabelDirection>("ascending");
  const [tool, setTool] = useState<Tool>("seat");
  const [overrides, setOverrides] = useState<Record<string, Tool>>({});
  const [center, setCenter] = useState(6);
  const cells = useMemo(() => rowLabels.flatMap((rowLabel, rowIndex) => columnLabels.map((columnLabel, columnIndex): Cell => {
    const mode = overrides[`${rowIndex}:${columnIndex}`] ?? "seat";
    return { rowIndex, columnIndex, rowLabel, columnLabel, kind: mode === "aisle" || mode === "empty" ? mode : "seat", selectable: mode !== "blocked" && mode !== "aisle" && mode !== "empty", golden: mode === "golden" };
  })), [columnLabels, overrides, rowLabels]);
  const payload = JSON.stringify({ rows: rowLabels.length, columns: columnLabels.length, centerAfterColumn: center, cells });

  function resizeRows(value: number) { setRowLabels((old) => Array.from({ length: value }, (_, i) => old[i] ?? generateSeatLabels(value, rowStyle, rowDirection)[i]!)); }
  function resizeColumns(value: number) { setColumnLabels((old) => Array.from({ length: value }, (_, i) => old[i] ?? generateSeatLabels(value, columnStyle, columnDirection)[i]!)); }
  return (
    <fieldset className="layout-editor">
      <legend>座位布局</legend>
      <div className="layout-controls">
        <label>行数<input type="number" min="1" max="50" value={rowLabels.length} onChange={(e) => resizeRows(Number(e.target.value))} /></label>
        <label>列数<input type="number" min="1" max="50" value={columnLabels.length} onChange={(e) => resizeColumns(Number(e.target.value))} /></label>
        <label>中线位于第几列后<input type="number" min="0" max={columnLabels.length - 1} value={center} onChange={(e) => setCenter(Number(e.target.value))} /></label>
      </div>
      <div className="label-presets">
        <div><strong>快速生成行名称</strong><select aria-label="行名称格式" value={rowStyle} onChange={(event) => setRowStyle(event.target.value as LabelStyle)}><option value="letters">字母</option><option value="numbers">数字</option></select><select aria-label="行名称顺序" value={rowDirection} onChange={(event) => setRowDirection(event.target.value as LabelDirection)}><option value="ascending">正序</option><option value="descending">倒序</option></select><button type="button" onClick={() => setRowLabels(generateSeatLabels(rowLabels.length, rowStyle, rowDirection))}>生成</button></div>
        <div><strong>快速生成列名称</strong><select aria-label="列名称格式" value={columnStyle} onChange={(event) => setColumnStyle(event.target.value as LabelStyle)}><option value="letters">字母</option><option value="numbers">数字</option></select><select aria-label="列名称顺序" value={columnDirection} onChange={(event) => setColumnDirection(event.target.value as LabelDirection)}><option value="ascending">正序</option><option value="descending">倒序</option></select><button type="button" onClick={() => setColumnLabels(generateSeatLabels(columnLabels.length, columnStyle, columnDirection))}>生成</button></div>
      </div>
      <div className="label-editor">
        <div><strong>行名称</strong>{rowLabels.map((label, i) => <input aria-label={`第${i + 1}行名称`} key={i} value={label} onChange={(e) => setRowLabels((old) => old.map((item, index) => index === i ? e.target.value : item))} />)}</div>
        <div><strong>列名称</strong>{columnLabels.map((label, i) => <input aria-label={`第${i + 1}列名称`} key={i} value={label} onChange={(e) => setColumnLabels((old) => old.map((item, index) => index === i ? e.target.value : item))} />)}</div>
      </div>
      <div className="tool-row" role="toolbar" aria-label="布局绘制工具">
        {(["seat", "blocked", "golden", "aisle", "empty"] as const).map((item) => <button className={tool === item ? "active" : ""} type="button" key={item} onClick={() => setTool(item)}>{({ seat: "可选", blocked: "不可选", golden: "黄金区", aisle: "过道", empty: "空白" } as const)[item]}</button>)}
      </div>
      <div className="seat-grid seat-grid-with-coordinates" style={{ gridTemplateColumns: `max-content repeat(${columnLabels.length}, 36px)` }}>
        <span className="seat-coordinate corner" aria-hidden="true" />
        {columnLabels.map((label, index) => <span className="seat-coordinate column" key={`column:${index}`}>{label}</span>)}
        {rowLabels.map((rowLabel, rowIndex) => <div className="seat-coordinate-row" style={{ gridColumn: `1 / span ${columnLabels.length + 1}`, gridTemplateColumns: `max-content repeat(${columnLabels.length}, 36px)` }} key={`row:${rowIndex}`}><span className="seat-coordinate row">{rowLabel}</span>{cells.filter((cell) => cell.rowIndex === rowIndex).map((cell) => {
          const mode = overrides[`${cell.rowIndex}:${cell.columnIndex}`] ?? "seat";
          return <button title={`${cell.rowLabel} ${cell.columnLabel}`} aria-label={`${cell.rowLabel}${cell.columnLabel}：${mode}`} className={`editor-seat ${mode}`} type="button" key={`${cell.rowIndex}:${cell.columnIndex}`} onClick={() => setOverrides((old) => ({ ...old, [`${cell.rowIndex}:${cell.columnIndex}`]: tool }))}>{cell.kind === "seat" ? cell.columnIndex + 1 : ""}</button>;
        })}</div>)}
      </div>
      <input type="hidden" name="layout" value={payload} />
    </fieldset>
  );
}

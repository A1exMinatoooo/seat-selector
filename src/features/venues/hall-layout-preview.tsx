import { displaySeatNumber, formatSeatLabel } from "@/shared/seat-label";
import { SeatGridViewport } from "@/features/seating/seat-grid-viewport";
import type { LayoutCell } from "./seat-layout-editor";

function cellMode(cell: LayoutCell): string {
  if (cell.kind === "aisle" || cell.kind === "empty") return cell.kind;
  if (cell.golden) return "golden";
  return cell.selectable ? "seat" : "blocked";
}

export function HallLayoutPreview({
  cells,
  centerAfterColumn,
}: {
  cells: LayoutCell[];
  centerAfterColumn: number | null;
}) {
  const columns = Math.max(...cells.map((cell) => cell.columnIndex), 0) + 1;
  const rowIndexes = [...new Set(cells.map((cell) => cell.rowIndex))];
  return (
    <SeatGridViewport
      ariaLabel="已保存的影厅座位布局"
      className="preview-grid-viewport"
      layoutKey={`${cells.length}:${columns}:${centerAfterColumn ?? "none"}`}
      legend={<div className="legend" aria-label="影厅预览图例">
        <span className="available">普通座位</span>
        <span className="golden">黄金区</span>
        <span className="blocked">不可选</span>
        <span className="aisle">过道</span>
        <span className="empty">空白</span>
        <span className="divider">左右半场中线</span>
      </div>}
    >
      <div className="seat-grid saved-layout-grid" role="img" aria-label="已保存的影厅座位布局">
        {rowIndexes.map((rowIndex) => {
          const rowCells = cells.filter((cell) => cell.rowIndex === rowIndex);
          return (
            <div
              className="seat-coordinate-row"
              style={{ gridTemplateColumns: `max-content repeat(${columns}, 36px)` }}
              key={rowIndex}
            >
              <span className="seat-coordinate row" data-seat-row-coordinate={rowCells[0]?.rowLabel ?? rowIndex + 1} data-seat-row-key={`preview:${rowIndex}`}>{rowCells[0]?.rowLabel ?? rowIndex + 1}</span>
              {rowCells.map((cell) => (
                <span
                  className={`editor-seat saved-layout-seat ${cellMode(cell)} ${centerAfterColumn === cell.columnIndex ? "center-divider" : ""}`}
                  title={formatSeatLabel(cell.rowLabel, cell.columnLabel)}
                  key={`${cell.rowIndex}:${cell.columnIndex}`}
                >
                  {cell.kind === "seat" ? displaySeatNumber(cell.columnLabel) : ""}
                </span>
              ))}
            </div>
          );
        })}
      </div>
    </SeatGridViewport>
  );
}

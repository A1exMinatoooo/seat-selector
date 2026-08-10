export const publicSeatPitch = 50;
export const publicSeatDividerOffset = 4;

export function effectiveCenterAfterColumn(columns: number, centerAfterColumn: number | null): number {
  if (columns < 1) return 0;
  return Math.min(Math.max(centerAfterColumn ?? Math.floor(columns / 2), 0), columns - 1);
}

export function centerDividerOffset(columns: number, centerAfterColumn: number | null): number {
  return (effectiveCenterAfterColumn(columns, centerAfterColumn) + 1) * publicSeatPitch - publicSeatDividerOffset;
}

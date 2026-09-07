import { effectiveCenterAfterColumn } from "@/server/domain/seat-center";
export { effectiveCenterAfterColumn } from "@/server/domain/seat-center";

export const publicSeatPitch = 50;
export const publicSeatDividerOffset = 4;

export function centerDividerOffset(columns: number, centerAfterColumn: number | null): number {
  return (effectiveCenterAfterColumn(columns, centerAfterColumn) + 1) * publicSeatPitch - publicSeatDividerOffset;
}

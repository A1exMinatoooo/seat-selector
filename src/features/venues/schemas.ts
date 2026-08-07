import { z } from "zod";

export const seatCellSchema = z.object({
  rowIndex: z.number().int().min(0).max(99),
  columnIndex: z.number().int().min(0).max(99),
  rowLabel: z.string().trim().min(1).max(12),
  columnLabel: z.string().trim().min(1).max(12),
  kind: z.enum(["seat", "aisle", "empty"]),
  selectable: z.boolean(),
  golden: z.boolean(),
});

export const hallLayoutSchema = z.object({
  rows: z.number().int().min(1).max(50),
  columns: z.number().int().min(1).max(50),
  centerAfterColumn: z.number().int().min(0).max(49).nullable(),
  cells: z.array(seatCellSchema).min(1).max(2500),
});

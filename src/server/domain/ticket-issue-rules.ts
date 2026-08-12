import { z } from "zod";

export const ticketIssueAllocationSchema = z.array(z.object({ ticketTypeId: z.string().uuid(), quantity: z.number().int().min(1).max(20) })).min(1).max(20)
  .refine((items) => new Set(items.map((item) => item.ticketTypeId)).size === items.length, "票种不能重复");

export function ticketIssueTotal(allocation: Array<{ quantity: number }>): number {
  return allocation.reduce((sum, item) => sum + item.quantity, 0);
}

export function hasOnsiteLotteryCapacity(usedByOthers: number, requested: number, expected: number): boolean {
  return usedByOthers + requested <= expected;
}

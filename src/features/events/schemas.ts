import { z } from "zod";

export const eventInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  hallId: z.string().uuid(),
  locationId: z.string().uuid(),
  radiusMeters: z.coerce.number().int().min(50).max(100_000),
  startsAt: z.coerce.date(),
  timeZone: z.string().trim().min(1).max(64),
  ticketTypes: z.array(z.string().trim().min(1).max(40)).min(1).max(20).refine((items) => new Set(items).size === items.length, "票种名称不能重复"),
});

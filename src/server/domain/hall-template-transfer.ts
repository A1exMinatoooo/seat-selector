import { z } from "zod";
import { hallLayoutSchema } from "@/features/venues/schemas";

export const hallTemplateBundleSchema = z.object({
  format: z.literal("pick-your-seat/hall-templates"),
  version: z.literal(1),
  exportedAt: z.string().datetime(),
  cinemas: z.array(z.object({
    name: z.string().trim().min(1).max(80),
    halls: z.array(z.object({
      name: z.string().trim().min(1).max(80),
      layout: hallLayoutSchema,
    })).min(1).max(100),
  })).min(1).max(200),
});

export type HallTemplateBundle = z.infer<typeof hallTemplateBundleSchema>;

export function parseHallTemplateBundle(value: unknown): HallTemplateBundle {
  return hallTemplateBundleSchema.parse(value);
}

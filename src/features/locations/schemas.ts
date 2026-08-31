import { z } from "zod";

export const locationPresetSchema = z.object({
  name: z.string().trim().min(1).max(80),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  defaultRadiusMeters: z.coerce.number().int().min(50).max(100_000),
});

export const locationPresetUpdateSchema = locationPresetSchema.extend({ id: z.string().uuid() });

export const appleMapsImportInputSchema = z.string().trim().min(1).max(4096);

export type LocationPresetInput = z.infer<typeof locationPresetSchema>;

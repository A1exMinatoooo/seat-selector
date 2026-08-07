"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/server/db/client";
import { locationPresets } from "@/server/db/schema";
import { requireAdmin } from "@/server/security/admin-session";

const locationSchema = z.object({
  name: z.string().trim().min(1).max(80),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  defaultRadiusMeters: z.coerce.number().int().min(50).max(100_000),
});

export async function createLocationAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const input = locationSchema.parse(Object.fromEntries(formData));
  await getDb().insert(locationPresets).values(input);
  revalidatePath("/admin/locations");
}

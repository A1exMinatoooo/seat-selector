import "server-only";

import { asc, eq } from "drizzle-orm";
import type { LocationPresetInput } from "@/features/locations/schemas";
import { getDb } from "./client";
import { locationPresets } from "./schema";

export async function listLocationPresets() {
  return getDb().select().from(locationPresets).orderBy(asc(locationPresets.name));
}

export async function findLocationPreset(id: string) {
  const [location] = await getDb().select().from(locationPresets).where(eq(locationPresets.id, id)).limit(1);
  return location ?? null;
}

export async function createLocationPreset(input: LocationPresetInput): Promise<void> {
  await getDb().insert(locationPresets).values(input);
}

export async function updateLocationPreset(id: string, input: LocationPresetInput): Promise<boolean> {
  const [updated] = await getDb().update(locationPresets).set(input).where(eq(locationPresets.id, id)).returning({ id: locationPresets.id });
  return Boolean(updated);
}

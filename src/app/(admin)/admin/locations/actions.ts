"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { locationPresetSchema, locationPresetUpdateSchema } from "@/features/locations/schemas";
import { createLocationPreset, updateLocationPreset } from "@/server/db/location-presets";
import { requireAdmin } from "@/server/security/admin-session";
import { postgresErrorInfo } from "@/shared/postgres-error";

export type LocationUpdateState = { status: "idle" | "error"; message: string; submission: number; code?: "INVALID_LOCATION" | "LOCATION_NOT_FOUND" | "LOCATION_NAME_CONFLICT" | "UPDATE_FAILED" };

export async function createLocationAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const input = locationPresetSchema.parse(Object.fromEntries(formData));
  await createLocationPreset(input);
  revalidatePath("/admin/locations");
}

export async function updateLocationAction(_previousState: LocationUpdateState, formData: FormData): Promise<LocationUpdateState> {
  await requireAdmin();
  const parsed = locationPresetUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "地点信息无效，请检查后重试。", submission: Date.now(), code: "INVALID_LOCATION" };
  const { id, ...input } = parsed.data;
  try {
    if (!(await updateLocationPreset(id, input))) return { status: "error", message: "地点不存在或已被删除。", submission: Date.now(), code: "LOCATION_NOT_FOUND" };
  } catch (error) {
    if (postgresErrorInfo(error).code === "23505") return { status: "error", message: "地点名称已存在，请使用其他名称。", submission: Date.now(), code: "LOCATION_NAME_CONFLICT" };
    console.error(JSON.stringify({ level: "error", message: "location_preset_update_failed", locationId: id, error: error instanceof Error ? error.message : "Unknown error" }));
    return { status: "error", message: "地点保存失败，请稍后重试。", submission: Date.now(), code: "UPDATE_FAILED" };
  }
  revalidatePath("/admin/locations");
  revalidatePath("/admin/events");
  redirect("/admin/locations");
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  adminActionError,
  adminActionSuccess,
  type AdminActionState,
} from "@/features/admin/admin-action-state";
import { locationPresetSchema, locationPresetUpdateSchema } from "@/features/locations/schemas";
import {
  createLocationPreset,
  deleteLocationPreset,
  updateLocationPreset,
} from "@/server/db/location-presets";
import { LocationInUseError } from "@/server/domain/location-preset";
import { requireAdmin } from "@/server/security/admin-session";
import { postgresErrorInfo } from "@/shared/postgres-error";

export type LocationUpdateState = AdminActionState;
export type LocationDeleteState = AdminActionState;

export async function createLocationAction(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdmin();
  const parsed = locationPresetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return adminActionError("地点信息无效，请检查后重试。", "INVALID_LOCATION");
  try {
    await createLocationPreset(parsed.data);
  } catch (error) {
    if (postgresErrorInfo(error).code === "23505")
      return adminActionError("地点名称已存在，请使用其他名称。", "LOCATION_NAME_CONFLICT");
    console.error(
      JSON.stringify({
        level: "error",
        message: "location_preset_create_failed",
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    );
    return adminActionError("地点保存失败，请稍后重试。", "LOCATION_CREATE_FAILED");
  }
  revalidatePath("/admin/locations");
  return adminActionSuccess("地点已保存。", "LOCATION_CREATED");
}

export async function updateLocationAction(
  _previousState: LocationUpdateState,
  formData: FormData,
): Promise<LocationUpdateState> {
  await requireAdmin();
  const parsed = locationPresetUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return adminActionError("地点信息无效，请检查后重试。", "INVALID_LOCATION");
  const { id, ...input } = parsed.data;
  try {
    if (!(await updateLocationPreset(id, input)))
      return adminActionError("地点不存在或已被删除。", "LOCATION_NOT_FOUND");
  } catch (error) {
    if (postgresErrorInfo(error).code === "23505")
      return adminActionError("地点名称已存在，请使用其他名称。", "LOCATION_NAME_CONFLICT");
    console.error(
      JSON.stringify({
        level: "error",
        message: "location_preset_update_failed",
        locationId: id,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    );
    return adminActionError("地点保存失败，请稍后重试。", "LOCATION_UPDATE_FAILED");
  }
  revalidatePath("/admin/locations");
  revalidatePath("/admin/events");
  redirect("/admin/locations?notice=location-updated");
}

export async function deleteLocationAction(
  _previousState: LocationDeleteState,
  formData: FormData,
): Promise<LocationDeleteState> {
  await requireAdmin();
  const parsed = z.object({ id: z.string().uuid() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return adminActionError("地点标识无效，请刷新后重试。", "INVALID_LOCATION");
  try {
    if (!(await deleteLocationPreset(parsed.data.id)))
      return adminActionError("地点不存在或已被删除。", "LOCATION_NOT_FOUND");
  } catch (error) {
    if (error instanceof LocationInUseError)
      return adminActionError("该地点已有活动关联，不能删除。", "LOCATION_IN_USE");
    console.error(
      JSON.stringify({
        level: "error",
        message: "location_preset_delete_failed",
        locationId: parsed.data.id,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    );
    return adminActionError("地点删除失败，请稍后重试。", "LOCATION_DELETE_FAILED");
  }
  revalidatePath("/admin/locations");
  revalidatePath("/admin/events");
  redirect("/admin/locations?notice=location-deleted");
}

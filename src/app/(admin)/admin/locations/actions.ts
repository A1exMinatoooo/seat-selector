"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  adminActionError,
  adminActionSuccess,
  type AdminActionState,
} from "@/features/admin/admin-action-state";
import {
  appleMapsImportInputSchema,
  locationPresetSchema,
  locationPresetUpdateSchema,
} from "@/features/locations/schemas";
import {
  createLocationPreset,
  deleteLocationPreset,
  updateLocationPreset,
} from "@/server/db/location-presets";
import { LocationInUseError } from "@/server/domain/location-preset";
import {
  parseAppleMapsLocation,
  type AppleMapsLocationErrorCode,
} from "@/server/domain/apple-maps-location";
import { requireAdmin } from "@/server/security/admin-session";
import { postgresErrorInfo } from "@/shared/postgres-error";

export type LocationUpdateState = AdminActionState;
export type LocationDeleteState = AdminActionState;
export type LocationCreateState = AdminActionState & { resetKey: number };

export type AppleMapsLocationImportState =
  | {
      status: "success";
      code: "APPLE_MAPS_LOCATION_IMPORTED";
      message: string;
      name: string | null;
      nameNotice: "missing" | "too-long" | null;
      latitude: string;
      longitude: string;
      conversion: "gcj02-to-wgs84" | "unchanged";
    }
  | { status: "error"; code: AppleMapsLocationErrorCode; message: string };

const appleMapsImportErrorMessages: Record<AppleMapsLocationErrorCode, string> = {
  INVALID_APPLE_MAPS_URL: "请输入有效的 Apple 地图完整链接。",
  UNSUPPORTED_APPLE_MAPS_URL: "仅支持 https://maps.apple.com 的完整链接。",
  MISSING_APPLE_MAPS_COORDINATE: "链接中没有找到 coordinate 或 ll 坐标参数。",
  AMBIGUOUS_APPLE_MAPS_COORDINATE: "链接包含多个坐标参数，无法确定要导入的地点。",
  INVALID_APPLE_MAPS_COORDINATE: "链接中的坐标格式或范围无效。",
};

export async function importAppleMapsLocationAction(
  rawUrl: unknown,
): Promise<AppleMapsLocationImportState> {
  await requireAdmin();
  const input = appleMapsImportInputSchema.safeParse(rawUrl);
  if (!input.success) {
    return {
      status: "error",
      code: "INVALID_APPLE_MAPS_URL",
      message: appleMapsImportErrorMessages.INVALID_APPLE_MAPS_URL,
    };
  }
  const parsed = parseAppleMapsLocation(input.data);
  if (!parsed.ok) {
    return {
      status: "error",
      code: parsed.code,
      message: appleMapsImportErrorMessages[parsed.code],
    };
  }
  const nameNotice = !parsed.name ? "missing" : parsed.name.length > 80 ? "too-long" : null;
  return {
    status: "success",
    code: "APPLE_MAPS_LOCATION_IMPORTED",
    message:
      parsed.conversion === "gcj02-to-wgs84"
        ? "坐标已从 GCJ-02 转换为 WGS-84。"
        : "坐标位于转换范围外，已按 WGS-84 原样导入。",
    name: nameNotice ? null : parsed.name,
    nameNotice,
    latitude: parsed.latitude.toFixed(7),
    longitude: parsed.longitude.toFixed(7),
    conversion: parsed.conversion,
  };
}

export async function createLocationAction(
  previousState: LocationCreateState,
  formData: FormData,
): Promise<LocationCreateState> {
  await requireAdmin();
  const parsed = locationPresetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ...adminActionError("地点信息无效，请检查后重试。", "INVALID_LOCATION"),
      resetKey: previousState.resetKey,
    };
  }
  try {
    await createLocationPreset(parsed.data);
  } catch (error) {
    if (postgresErrorInfo(error).code === "23505") {
      return {
        ...adminActionError("地点名称已存在，请使用其他名称。", "LOCATION_NAME_CONFLICT"),
        resetKey: previousState.resetKey,
      };
    }
    console.error(
      JSON.stringify({
        level: "error",
        message: "location_preset_create_failed",
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    );
    return {
      ...adminActionError("地点保存失败，请稍后重试。", "LOCATION_CREATE_FAILED"),
      resetKey: previousState.resetKey,
    };
  }
  revalidatePath("/admin/locations");
  const success = adminActionSuccess("地点已保存。", "LOCATION_CREATED");
  return { ...success, resetKey: success.submission };
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

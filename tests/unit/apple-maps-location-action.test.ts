import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({ requireAdmin: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/server/db/location-presets", () => ({
  createLocationPreset: vi.fn(),
  deleteLocationPreset: vi.fn(),
  updateLocationPreset: vi.fn(),
}));
vi.mock("@/server/security/admin-session", () => ({
  requireAdmin: dependencies.requireAdmin,
}));

import { importAppleMapsLocationAction } from "@/app/(admin)/admin/locations/actions";

beforeEach(() => dependencies.requireAdmin.mockReset());

describe("Apple Maps location import action", () => {
  it("authenticates, validates, and returns seven-decimal WGS-84 coordinates", async () => {
    const result = await importAppleMapsLocationAction(
      "https://maps.apple.com/place?address=Shenzhen%20Guangdong%20China&coordinate=22.523833,113.969738&name=影城",
    );
    expect(dependencies.requireAdmin).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      status: "success",
      code: "APPLE_MAPS_LOCATION_IMPORTED",
      name: "影城",
      nameNotice: null,
      latitude: "22.5268020",
      longitude: "113.9648271",
      conversion: "gcj02-to-wgs84",
    });
  });

  it("keeps coordinate imports usable when the name is absent or too long", async () => {
    await expect(
      importAppleMapsLocationAction("https://maps.apple.com/?coordinate=35.6812,139.7671"),
    ).resolves.toMatchObject({ status: "success", name: null, nameNotice: "missing" });
    await expect(
      importAppleMapsLocationAction(
        `https://maps.apple.com/?coordinate=35.6812,139.7671&name=${"a".repeat(81)}`,
      ),
    ).resolves.toMatchObject({ status: "success", name: null, nameNotice: "too-long" });
  });

  it("returns stable validation errors without parsing oversized input", async () => {
    await expect(importAppleMapsLocationAction("")).resolves.toEqual({
      status: "error",
      code: "INVALID_APPLE_MAPS_URL",
      message: "请输入有效的 Apple 地图完整链接。",
    });
    await expect(
      importAppleMapsLocationAction("https://maps.apple.com/place?name=入口"),
    ).resolves.toMatchObject({ status: "error", code: "MISSING_APPLE_MAPS_COORDINATE" });
  });
});

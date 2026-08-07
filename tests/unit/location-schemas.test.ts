import { describe, expect, it } from "vitest";
import { locationPresetSchema, locationPresetUpdateSchema } from "@/features/locations/schemas";

describe("location preset validation", () => {
  it("coerces valid form values", () => {
    expect(locationPresetSchema.parse({ name: "  一号厅入口  ", latitude: "31.2304", longitude: "121.4737", defaultRadiusMeters: "1000" })).toEqual({ name: "一号厅入口", latitude: 31.2304, longitude: 121.4737, defaultRadiusMeters: 1000 });
  });

  it("rejects invalid coordinates and identifiers", () => {
    expect(locationPresetSchema.safeParse({ name: "入口", latitude: "91", longitude: "121", defaultRadiusMeters: "1000" }).success).toBe(false);
    expect(locationPresetUpdateSchema.safeParse({ id: "bad-id", name: "入口", latitude: "31", longitude: "121", defaultRadiusMeters: "1000" }).success).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { distanceMeters, isLocationAllowed } from "@/features/locations/distance";

describe("location distance", () => {
  it("calculates a stable short distance", () => {
    const distance = distanceMeters({ latitude: 31.2304, longitude: 121.4737 }, { latitude: 31.2314, longitude: 121.4737 });
    expect(distance).toBeGreaterThan(110);
    expect(distance).toBeLessThan(112);
  });

  it("rejects inaccurate or distant samples", () => {
    expect(isLocationAllowed(900, 40, 1000)).toBe(true);
    expect(isLocationAllowed(1100, 40, 1000)).toBe(false);
    expect(isLocationAllowed(100, 600, 1000)).toBe(false);
  });
});

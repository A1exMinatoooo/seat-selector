import { describe, expect, it } from "vitest";
import { clampSeatGridScale, fitSeatGridScale } from "@/features/seating/seat-grid-viewport";

describe("seat grid viewport scale", () => {
  it("fits both grid dimensions inside the viewport without enlarging small grids", () => {
    expect(fitSeatGridScale(1024, 600, 2000, 400)).toBe(0.5);
    expect(fitSeatGridScale(1024, 600, 600, 300)).toBe(1);
    expect(fitSeatGridScale(1078, 367, 2173, 350)).toBe(0.48);
  });

  it("keeps manual and fitted zoom within supported limits", () => {
    expect(clampSeatGridScale(0.1)).toBe(0.25);
    expect(clampSeatGridScale(3)).toBe(2);
    expect(fitSeatGridScale(200, 200, 2000, 2000)).toBe(0.25);
  });
});

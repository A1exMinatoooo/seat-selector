import { describe, expect, it } from "vitest";
import { centeredSeatGridScrollLeft, clampSeatGridScale, fitSeatGridHeightScale, fitSeatGridScale, pinchSeatGridScale } from "@/features/seating/seat-grid-viewport";

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

  it("fits every row vertically without shrinking for the grid width", () => {
    expect(fitSeatGridHeightScale(600, 800)).toBe(0.72);
    expect(fitSeatGridHeightScale(600, 400)).toBe(1);
    expect(fitSeatGridHeightScale(200, 2000)).toBe(0.25);
  });

  it("centers a focus point horizontally within the scrollable range", () => {
    expect(centeredSeatGridScrollLeft(360, 924, 462)).toBe(282);
    expect(centeredSeatGridScrollLeft(360, 924, 87)).toBe(0);
    expect(centeredSeatGridScrollLeft(800, 800, 400)).toBe(0);
  });

  it("converts a two-finger distance change into a bounded grid scale", () => {
    expect(pinchSeatGridScale(1, 100, 150)).toBe(1.5);
    expect(pinchSeatGridScale(0.5, 100, 50)).toBe(0.25);
    expect(pinchSeatGridScale(1.5, 100, 200)).toBe(2);
  });
});

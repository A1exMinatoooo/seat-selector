import { describe, expect, it } from "vitest";
import {
  centeredSeatGridScrollLeft,
  clampSeatGridScale,
  fitSeatGridHeightScale,
  fitSeatGridScale,
  frozenSeatCoordinateTop,
  pinchSeatGridScale,
  seatGridMinimapSize,
  seatGridMinimapViewport,
} from "@/features/seating/seat-grid-viewport";

describe("seat grid viewport scale", () => {
  it("fits both grid dimensions inside the viewport without enlarging small grids", () => {
    expect(fitSeatGridScale(1024, 600, 2000, 400)).toBe(0.5);
    expect(fitSeatGridScale(1024, 600, 600, 300)).toBe(1);
    expect(fitSeatGridScale(1078, 367, 2173, 350)).toBe(0.48);
  });

  it("keeps manual and fitted zoom within supported limits", () => {
    expect(clampSeatGridScale(0.01)).toBe(0.05);
    expect(clampSeatGridScale(3)).toBe(2);
    expect(fitSeatGridScale(200, 200, 2000, 2000)).toBe(0.08);
    expect(fitSeatGridScale(360, 600, 2500, 2500)).toBe(0.13);
  });

  it("fits every row vertically without shrinking for the grid width", () => {
    expect(fitSeatGridHeightScale(600, 800)).toBe(0.72);
    expect(fitSeatGridHeightScale(600, 400)).toBe(1);
    expect(fitSeatGridHeightScale(200, 2000)).toBe(0.08);
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

  it("projects row coordinates into the fixed viewport overlay", () => {
    expect(frozenSeatCoordinateTop(248.375, 100.125)).toBe(148.25);
    expect(frozenSeatCoordinateTop(80, 100)).toBe(-20);
  });

  it("scales the whole grid into a bounded mobile minimap", () => {
    expect(seatGridMinimapSize(1000, 500)).toEqual({ width: 136, height: 68, scale: 0.136 });
    expect(seatGridMinimapSize(400, 800)).toEqual({ width: 48, height: 96, scale: 0.12 });
    expect(seatGridMinimapSize(0, 800)).toEqual({ width: 0, height: 0, scale: 0 });
  });

  it("maps the visible canvas area into minimap percentages", () => {
    expect(seatGridMinimapViewport(360, 500, 282, 100, 12, 12, 924, 800)).toEqual({
      left: 29.22077922077922,
      top: 11,
      width: 38.961038961038966,
      height: 62.5,
    });
    expect(seatGridMinimapViewport(360, 500, 0, 0, 12, 12, 200, 300)).toEqual({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
    });
  });
});

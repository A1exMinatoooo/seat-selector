import { describe, expect, it } from "vitest";
import {
  seatScreenPosition,
  centeredSeatGridScrollLeft,
  clampSeatGridScale,
  fitSeatGridHeightScale,
  fitSeatGridScale,
  frozenSeatCoordinateTop,
  gestureSeatGridScale,
  pinchSeatGridScale,
  seatGridFocalContentOffset,
  seatGridFocusedScrollOffset,
  seatGridMinimapSize,
  seatGridMinimapViewport,
  wheelSeatGridScale,
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

  it("converts desktop trackpad pinch deltas into smooth bounded scale changes", () => {
    expect(wheelSeatGridScale(1, -10)).toBeCloseTo(1.105, 3);
    expect(wheelSeatGridScale(1, 10)).toBeCloseTo(0.905, 3);
    expect(wheelSeatGridScale(2, -50)).toBe(2);
    expect(wheelSeatGridScale(0.05, 50)).toBe(0.05);
  });

  it("converts Safari gesture scale without exceeding the shared limits", () => {
    expect(gestureSeatGridScale(0.8, 1.5)).toBe(1.2);
    expect(gestureSeatGridScale(1.5, 2)).toBe(2);
    expect(gestureSeatGridScale(0.1, 0.1)).toBe(0.05);
    expect(gestureSeatGridScale(1, Number.NaN)).toBe(1);
  });

  it("keeps the content under the gesture focal point stable after scaling", () => {
    const contentOffset = seatGridFocalContentOffset(300, 180, 12, 1);
    expect(contentOffset).toBe(468);
    expect(seatGridFocusedScrollOffset(contentOffset, 180, 12, 1.5)).toBe(534);
    expect(seatGridFocusedScrollOffset(20, 180, 12, 0.5)).toBe(0);
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

describe("seat screen placement", () => {
  it("keeps the screen fully visible and points toward the true center", () => {
    expect(seatScreenPosition(250, 500)).toEqual({ width: 240, screen: 250, direction: "center" });
    expect(seatScreenPosition(-100, 500)).toEqual({ width: 240, screen: 132, direction: "left" });
    expect(seatScreenPosition(800, 500)).toEqual({ width: 240, screen: 368, direction: "right" });
    expect(seatScreenPosition(80, 160)).toEqual({ width: 136, screen: 80, direction: "center" });
  });
});

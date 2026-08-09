import { describe, expect, it } from "vitest";
import { centerDividerOffset, effectiveCenterAfterColumn } from "@/features/seating/public-seat-layout";

describe("public seat layout", () => {
  it("uses the configured center for asymmetric layouts", () => {
    expect(effectiveCenterAfterColumn(12, 4)).toBe(4);
    expect(centerDividerOffset(12, 4)).toBe(196);
  });
  it("clamps a center placed on an aisle or outside the grid", () => {
    expect(effectiveCenterAfterColumn(8, 8)).toBe(8);
    expect(effectiveCenterAfterColumn(8, -2)).toBe(0);
  });
  it("falls back to the middle when the template has no center", () => {
    expect(effectiveCenterAfterColumn(9, null)).toBe(4);
  });
});

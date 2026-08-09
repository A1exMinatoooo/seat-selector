import { describe, expect, it } from "vitest";
import { canDeleteLocation } from "@/server/domain/location-preset";

describe("location deletion", () => {
  it("allows deletion only when no events are associated", () => {
    expect(canDeleteLocation(0)).toBe(true);
    expect(canDeleteLocation(1)).toBe(false);
  });
});

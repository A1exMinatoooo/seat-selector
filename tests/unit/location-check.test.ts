import { describe, expect, it } from "vitest";
import { isLocationCheckRequired } from "@/server/domain/location-check";

describe("activity location check", () => {
  it("requires a check when the activity enables it and the participant is not exempt", () => {
    expect(isLocationCheckRequired(true, null)).toBe(true);
  });

  it("skips the check when the activity disables it", () => {
    expect(isLocationCheckRequired(false, null)).toBe(false);
  });

  it("skips the check for an exempt participant", () => {
    expect(isLocationCheckRequired(true, new Date("2026-08-07T00:00:00Z"))).toBe(false);
  });
});

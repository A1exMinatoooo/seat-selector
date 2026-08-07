import { describe, expect, it } from "vitest";
import { browserLocationFailure } from "@/features/seating/location-audit";

describe("location audit", () => {
  it("maps browser geolocation failures to stable audit reasons", () => {
    expect(browserLocationFailure(1)).toBe("permission_denied");
    expect(browserLocationFailure(2)).toBe("position_unavailable");
    expect(browserLocationFailure(3)).toBe("timeout");
    expect(browserLocationFailure(99)).toBe("unknown");
  });
});

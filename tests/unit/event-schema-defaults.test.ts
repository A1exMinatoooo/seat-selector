import { describe, expect, it } from "vitest";
import { events } from "@/server/db/schema";

describe("event schema defaults", () => {
  it("defaults location checks to disabled for new rows", () => {
    expect(events.locationCheckEnabled.default).toBe(false);
  });
});

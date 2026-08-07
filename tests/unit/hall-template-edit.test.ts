import { describe, expect, it } from "vitest";
import { canEditHallTemplate } from "@/server/domain/hall-template-edit";

describe("hall template editing", () => {
  it("allows unused templates and templates used only by ended events", () => {
    expect(canEditHallTemplate([])).toBe(true);
    expect(canEditHallTemplate(["ended", "ended"])).toBe(true);
  });

  it("rejects templates used by draft or open events", () => {
    expect(canEditHallTemplate(["ended", "draft"])).toBe(false);
    expect(canEditHallTemplate(["open"])).toBe(false);
  });
});

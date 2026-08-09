import { describe, expect, it } from "vitest";
import { canDeleteHallTemplate, canEditHallTemplate } from "@/server/domain/hall-template-edit";

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

describe("hall template deletion", () => {
  it("allows deleting only templates with no associated events", () => {
    expect(canDeleteHallTemplate([])).toBe(true);
    expect(canDeleteHallTemplate(["ended"])).toBe(false);
    expect(canDeleteHallTemplate(["draft"])).toBe(false);
  });
});

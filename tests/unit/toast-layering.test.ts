import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../../src/app/globals.css", import.meta.url), "utf8");

function token(name: string) {
  const match = css.match(new RegExp(`--${name}:\\s*(\\d+);`));
  if (!match?.[1]) throw new Error(`Missing CSS token --${name}`);
  return Number(match[1]);
}

function rule(selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  if (!match?.[1]) throw new Error(`Missing CSS rule ${selector}`);
  return match[1];
}

describe("global overlay layering", () => {
  it("keeps toast above modal above popover", () => {
    expect(token("z-modal")).toBeGreaterThan(token("z-popover"));
    expect(token("z-toast")).toBeGreaterThan(token("z-modal"));
  });

  it.each([
    ".grouped-hall-select-listbox",
    ".export-menu-popover",
    ".select-field-popover",
    ".searchable-select-listbox",
    ".date-picker-popover",
    ".time-picker-popover",
  ])("assigns %s to the popover layer", (selector) => {
    expect(rule(selector)).toContain("z-index: var(--z-popover)");
  });

  it.each([".preview-backdrop", ".lottery-backdrop"])(
    "assigns %s to the modal layer",
    (selector) => {
      expect(rule(selector)).toContain("z-index: var(--z-modal)");
    },
  );

  it("assigns every shared toast to the highest layer without click-through", () => {
    expect(rule(".toast")).toContain("z-index: var(--z-toast)");
    expect(rule(".toast")).not.toContain("pointer-events: none");
  });
});

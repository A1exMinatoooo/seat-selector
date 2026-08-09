import { describe, expect, it } from "vitest";
import { parseHallTemplateBundle } from "@/server/domain/hall-template-transfer";

const cell = { rowIndex: 0, columnIndex: 0, rowLabel: "A", columnLabel: "", kind: "seat" as const, selectable: true, golden: false };

describe("hall template transfer", () => {
  it("accepts versioned bundles with unnumbered seats", () => {
    const bundle = parseHallTemplateBundle({ format: "pick-your-seat/hall-templates", version: 1, exportedAt: new Date().toISOString(), cinemas: [{ name: "影院", halls: [{ name: "1号厅", layout: { rows: 1, columns: 1, centerAfterColumn: 0, cells: [cell] } }] }] });
    expect(bundle.cinemas[0]?.halls[0]?.layout.cells[0]?.columnLabel).toBe("");
  });

  it("allows blank row labels", () => {
    const bundle = parseHallTemplateBundle({ format: "pick-your-seat/hall-templates", version: 1, exportedAt: new Date().toISOString(), cinemas: [{ name: "影院", halls: [{ name: "1号厅", layout: { rows: 1, columns: 1, centerAfterColumn: 0, cells: [{ ...cell, rowLabel: "   " }] } }] }] });
    expect(bundle.cinemas[0]?.halls[0]?.layout.cells[0]?.rowLabel).toBe("");
  });

  it("rejects unknown versions", () => {
    expect(() => parseHallTemplateBundle({ format: "pick-your-seat/hall-templates", version: 2, exportedAt: new Date().toISOString(), cinemas: [] })).toThrow();
  });
});

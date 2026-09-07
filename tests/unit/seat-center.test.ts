import { describe, expect, it } from "vitest";
import { effectiveCenterAfterColumn } from "@/server/domain/seat-center";
import { effectiveEventAvailability } from "@/server/domain/event-seat-availability";

describe("shared seat center", () => {
  it.each([
    [10, 4],
    [9, 3],
    [1, -1],
    [0, -1],
    [30, 14],
  ])("defaults %i columns to boundary %i", (columns, boundary) => {
    expect(effectiveCenterAfterColumn(columns, null)).toBe(boundary);
  });
  it("preserves a configured asymmetric boundary", () => {
    expect(effectiveCenterAfterColumn(30, 3)).toBe(3);
  });
  it.each([1, 9, 10])(
    "locks the displayed half using the full %i-column layout, including trailing empty cells",
    (columns) => {
      const seats = Array.from({ length: columns }, (_, columnIndex) => ({
        id: String(columnIndex),
        columnIndex,
        kind: columnIndex === columns - 1 && columns > 1 ? ("empty" as const) : ("seat" as const),
        templateSelectable: true,
      }));
      const boundary = effectiveCenterAfterColumn(columns, null);
      expect(
        effectiveEventAvailability(
          seats,
          seats.map((s) => s.id),
          "left",
          null,
        ),
      ).toEqual(
        seats.filter((s) => s.kind === "seat" && s.columnIndex > boundary).map((s) => s.id),
      );
    },
  );
});

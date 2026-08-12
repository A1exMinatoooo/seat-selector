import { describe, expect, it } from "vitest";
import {
  describeAvailabilityChange,
  detectLockedSeatHalf,
  quickOpenSeatRectangle,
  resolveEventAvailability,
  toggleSeatHalfLock,
  type GridPositionedSeat,
  type PositionedSeat,
  type SeatPosition,
} from "@/server/domain/event-seat-availability";

const seats: SeatPosition[] = [
  { id: "a", kind: "seat", templateSelectable: true },
  { id: "b", kind: "seat", templateSelectable: true },
  { id: "c", kind: "seat", templateSelectable: false },
  { id: "d", kind: "aisle", templateSelectable: true },
];

describe("resolveEventAvailability", () => {
  it("keeps only selectable template seats", () => {
    expect(resolveEventAvailability(seats, ["a", "c", "d", "unknown"])).toEqual(["a"]);
  });

  it("never removes a reserved selectable seat", () => {
    expect(resolveEventAvailability(seats, [], ["b"])).toEqual(["b"]);
  });
});

describe("describeAvailabilityChange", () => {
  it("summarizes additions and removals", () => {
    expect(describeAvailabilityChange(["a", "b", "c"], ["b", "c", "d", "e"])).toEqual({
      beforeCount: 3,
      afterCount: 4,
      addedCount: 2,
      removedCount: 1,
    });
  });
});

describe("toggleSeatHalfLock", () => {
  const positioned: PositionedSeat[] = [
    { id: "left-1", columnIndex: 0, kind: "seat", templateSelectable: true },
    { id: "left-2", columnIndex: 1, kind: "seat", templateSelectable: true },
    { id: "right-1", columnIndex: 2, kind: "seat", templateSelectable: true },
    { id: "right-2", columnIndex: 3, kind: "seat", templateSelectable: true },
  ];

  it("locks the requested side using the configured center", () => {
    const result = toggleSeatHalfLock(
      positioned,
      positioned.map((seat) => seat.id),
      [],
      "left",
      1,
    );
    expect(result).toEqual({
      availableSeatIds: ["right-1", "right-2"],
      previousSide: null,
      activeSide: "left",
      operation: "lock",
    });
  });

  it("keeps reserved seats inside the locked half", () => {
    expect(
      toggleSeatHalfLock(
        positioned,
        positioned.map((seat) => seat.id),
        ["left-1"],
        "left",
        1,
      ).availableSeatIds,
    ).toEqual(["left-1", "right-1", "right-2"]);
  });

  it("unlocks the active side when clicked again", () => {
    const result = toggleSeatHalfLock(positioned, ["right-1", "right-2"], [], "left", 1);
    expect(result).toEqual({
      availableSeatIds: positioned.map((seat) => seat.id),
      previousSide: "left",
      activeSide: null,
      operation: "unlock",
    });
  });

  it("preserves manual edits on the other side when unlocking", () => {
    const result = toggleSeatHalfLock(positioned, ["right-1"], [], "left", 1);
    expect(result.availableSeatIds).toEqual(["left-1", "left-2", "right-1"]);
  });

  it("switches sides while keeping the states mutually exclusive", () => {
    const result = toggleSeatHalfLock(positioned, ["right-1", "right-2"], [], "right", 1);
    expect(result).toEqual({
      availableSeatIds: ["left-1", "left-2"],
      previousSide: "left",
      activeSide: "right",
      operation: "switch",
    });
  });

  it("falls back to the geometric midpoint", () => {
    expect(
      toggleSeatHalfLock(
        positioned,
        positioned.map((seat) => seat.id),
        [],
        "left",
        null,
      ).availableSeatIds,
    ).toEqual(["right-1", "right-2"]);
  });

  it("detects the active side from the actual availability", () => {
    expect(detectLockedSeatHalf(positioned, ["right-1", "right-2"], [], 1)).toBe("left");
    expect(detectLockedSeatHalf(positioned, ["left-1", "left-2"], [], 1)).toBe("right");
    expect(
      detectLockedSeatHalf(
        positioned,
        positioned.map((seat) => seat.id),
        [],
        1,
      ),
    ).toBeNull();
  });
});

describe("quickOpenSeatRectangle", () => {
  const grid = (rows: number, columns: number): GridPositionedSeat[] =>
    Array.from({ length: rows }, (_, rowIndex) =>
      Array.from({ length: columns }, (_, columnIndex) => ({
        id: `${rowIndex}:${columnIndex}`,
        rowIndex,
        columnIndex,
        kind: "seat" as const,
        templateSelectable: true,
      })),
    ).flat();

  it("opens an exact, approximately 4:3 block anchored to the back-center", () => {
    const result = quickOpenSeatRectangle(grid(6, 8), 12, 3);
    expect(result).toMatchObject({ width: 4, height: 3 });
    expect(result.availableSeatIds).toHaveLength(12);
    expect(result.availableSeatIds.slice(0, 4)).toEqual(["5:3", "5:4", "5:2", "5:5"]);
    expect(result.availableSeatIds.every((id) => Number(id.split(":")[0]) >= 3)).toBe(true);
  });

  it("fills the final partial row from the center toward both sides", () => {
    expect(quickOpenSeatRectangle(grid(4, 7), 5, 2).availableSeatIds.slice(0, 5)).toEqual([
      "3:2",
      "3:3",
      "3:1",
      "2:2",
      "2:3",
    ]);
  });

  it("skips structural seats and expands until the requested count is exact", () => {
    const seats = grid(5, 6).map((seat) =>
      seat.id === "4:2" || seat.id === "3:3" ? { ...seat, templateSelectable: false } : seat,
    );
    const result = quickOpenSeatRectangle(seats, 8, 2);
    expect(result.availableSeatIds).toHaveLength(8);
    expect(result.availableSeatIds).not.toContain("4:2");
    expect(result.availableSeatIds).not.toContain("3:3");
  });

  it("rejects invalid or excessive counts without returning a partial result", () => {
    expect(() => quickOpenSeatRectangle(grid(2, 2), 0, null)).toThrow(RangeError);
    expect(() => quickOpenSeatRectangle(grid(2, 2), 5, null)).toThrow(RangeError);
  });
});

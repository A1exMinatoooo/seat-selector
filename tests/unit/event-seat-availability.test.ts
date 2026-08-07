import { describe, expect, it } from "vitest";
import { describeAvailabilityChange, detectLockedSeatHalf, resolveEventAvailability, toggleSeatHalfLock, type PositionedSeat, type SeatPosition } from "@/server/domain/event-seat-availability";

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
    const result = toggleSeatHalfLock(positioned, positioned.map((seat) => seat.id), [], "left", 1);
    expect(result).toEqual({ availableSeatIds: ["right-1", "right-2"], previousSide: null, activeSide: "left", operation: "lock" });
  });

  it("keeps reserved seats inside the locked half", () => {
    expect(toggleSeatHalfLock(positioned, positioned.map((seat) => seat.id), ["left-1"], "left", 1).availableSeatIds).toEqual(["left-1", "right-1", "right-2"]);
  });

  it("unlocks the active side when clicked again", () => {
    const result = toggleSeatHalfLock(positioned, ["right-1", "right-2"], [], "left", 1);
    expect(result).toEqual({ availableSeatIds: positioned.map((seat) => seat.id), previousSide: "left", activeSide: null, operation: "unlock" });
  });

  it("preserves manual edits on the other side when unlocking", () => {
    const result = toggleSeatHalfLock(positioned, ["right-1"], [], "left", 1);
    expect(result.availableSeatIds).toEqual(["left-1", "left-2", "right-1"]);
  });

  it("switches sides while keeping the states mutually exclusive", () => {
    const result = toggleSeatHalfLock(positioned, ["right-1", "right-2"], [], "right", 1);
    expect(result).toEqual({ availableSeatIds: ["left-1", "left-2"], previousSide: "left", activeSide: "right", operation: "switch" });
  });

  it("falls back to the geometric midpoint", () => {
    expect(toggleSeatHalfLock(positioned, positioned.map((seat) => seat.id), [], "left", null).availableSeatIds).toEqual(["right-1", "right-2"]);
  });

  it("detects the active side from the actual availability", () => {
    expect(detectLockedSeatHalf(positioned, ["right-1", "right-2"], [], 1)).toBe("left");
    expect(detectLockedSeatHalf(positioned, ["left-1", "left-2"], [], 1)).toBe("right");
    expect(detectLockedSeatHalf(positioned, positioned.map((seat) => seat.id), [], 1)).toBeNull();
  });
});

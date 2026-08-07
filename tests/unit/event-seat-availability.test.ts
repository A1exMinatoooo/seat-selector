import { describe, expect, it } from "vitest";
import { lockSeatHalf, resolveEventAvailability, type PositionedSeat, type SeatPosition } from "@/server/domain/event-seat-availability";

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

describe("lockSeatHalf", () => {
  const positioned: PositionedSeat[] = [
    { id: "left-1", columnIndex: 0, kind: "seat", templateSelectable: true },
    { id: "left-2", columnIndex: 1, kind: "seat", templateSelectable: true },
    { id: "right-1", columnIndex: 2, kind: "seat", templateSelectable: true },
    { id: "right-2", columnIndex: 3, kind: "seat", templateSelectable: true },
  ];

  it("locks the requested side using the configured center", () => {
    expect(lockSeatHalf(positioned, positioned.map((seat) => seat.id), [], "left", 1)).toEqual(["right-1", "right-2"]);
    expect(lockSeatHalf(positioned, positioned.map((seat) => seat.id), [], "right", 1)).toEqual(["left-1", "left-2"]);
  });

  it("keeps reserved seats inside the locked half", () => {
    expect(lockSeatHalf(positioned, positioned.map((seat) => seat.id), ["left-1"], "left", 1)).toEqual(["left-1", "right-1", "right-2"]);
  });

  it("falls back to the geometric midpoint", () => {
    expect(lockSeatHalf(positioned, positioned.map((seat) => seat.id), [], "left", null)).toEqual(["right-1", "right-2"]);
  });
});

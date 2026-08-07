import { describe, expect, it } from "vitest";
import { resolveEventAvailability, type SeatPosition } from "@/server/domain/event-seat-availability";

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

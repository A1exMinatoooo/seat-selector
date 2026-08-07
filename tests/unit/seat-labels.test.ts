import { describe, expect, it } from "vitest";
import { generateSeatLabels } from "@/features/venues/seat-labels";

describe("generateSeatLabels", () => {
  it("generates numeric labels in either direction", () => {
    expect(generateSeatLabels(3, "numbers", "ascending")).toEqual(["1", "2", "3"]);
    expect(generateSeatLabels(3, "numbers", "descending")).toEqual(["3", "2", "1"]);
  });

  it("supports alphabetic labels beyond Z", () => {
    const labels = generateSeatLabels(28, "letters", "ascending");
    expect(labels.slice(24)).toEqual(["Y", "Z", "AA", "AB"]);
  });

  it("reverses alphabetic labels", () => {
    expect(generateSeatLabels(3, "letters", "descending")).toEqual(["C", "B", "A"]);
  });
});

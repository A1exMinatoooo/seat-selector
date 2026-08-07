import { describe, expect, it } from "vitest";
import { nextSeatNumber } from "@/features/venues/seat-numbering";
import { displaySeatNumber, formatSeatLabel } from "@/shared/seat-label";

describe("nextSeatNumber", () => {
  it("continues numeric numbering across unlabelled gaps", () => {
    expect(nextSeatNumber(["1", "", "", "2"], "numbers")).toBe("3");
  });

  it("does not reuse a cleared number when a later number remains", () => {
    expect(nextSeatNumber(["1", "", "3"], "numbers")).toBe("4");
  });

  it("continues from the last remaining number after trailing labels are cleared", () => {
    expect(nextSeatNumber(["1", "2", ""], "numbers")).toBe("3");
  });

  it("supports alphabetic sequences beyond Z and ignores custom labels", () => {
    expect(nextSeatNumber(["Z", "入口", "AA"], "letters")).toBe("AB");
  });

  it("removes a stored seat suffix from map labels", () => {
    expect(displaySeatNumber("12座")).toBe("12");
    expect(displaySeatNumber("B座")).toBe("B");
    expect(displaySeatNumber("B")).toBe("B");
  });

  it("formats complete seat names outside the map", () => {
    expect(formatSeatLabel("A", "12")).toBe("A排12座");
    expect(formatSeatLabel("A排", "12座")).toBe("A排12座");
    expect(formatSeatLabel("A", "")).toBe("A排未编号座");
  });
});

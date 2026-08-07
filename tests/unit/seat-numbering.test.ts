import { describe, expect, it } from "vitest";
import { nextSeatNumber } from "@/features/venues/seat-numbering";

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
});

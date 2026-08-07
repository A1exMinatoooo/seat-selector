import { describe, expect, it } from "vitest";
import { maskPhone } from "@/shared/phone";

describe("phone masking", () => {
  it("masks full phone numbers and four-digit records", () => {
    expect(maskPhone("13800138000", true)).toBe("138****8000");
    expect(maskPhone("5678", false)).toBe("****5678");
  });
});

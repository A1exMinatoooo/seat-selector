import { describe, expect, it } from "vitest";
import { numericInputError, validNumericValue } from "@/features/forms/numeric-input-validation";

describe("numeric input validation", () => {
  it("treats an empty focused draft as missing instead of zero", () => {
    expect(numericInputError("", { min: 0 })).toBe("请输入内容");
    expect(validNumericValue("", { min: 0 })).toBeNull();
  });

  it("validates range and integer constraints", () => {
    expect(numericInputError("0", { min: 1, max: 50 })).toBe("请输入不小于 1 的数字");
    expect(numericInputError("51", { min: 1, max: 50 })).toBe("请输入不大于 50 的数字");
    expect(numericInputError("1.5", { min: 1, step: 1 })).toBe("请输入整数");
    expect(validNumericValue("12", { min: 1, max: 50, step: 1 })).toBe(12);
    expect(validNumericValue("", { min: 1, max: 50, step: 1 })).toBeNull();
    expect(validNumericValue("51", { min: 1, max: 50, step: 1 })).toBeNull();
    expect(validNumericValue("1.5", { min: 1, max: 50, step: 1 })).toBeNull();
  });

  it("accepts decimal coordinates with any step", () => {
    expect(validNumericValue("31.2304", { min: -90, max: 90, step: "any" })).toBe(31.2304);
  });
});

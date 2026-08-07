import { describe, expect, it } from "vitest";
import { formatDateTimeMilliseconds } from "@/shared/date-time";

describe("millisecond date-time formatting", () => {
  it("renders exactly three fractional-second digits in the event time zone", () => {
    const formatted = formatDateTimeMilliseconds(new Date("2026-08-07T05:06:07.123Z"), "Asia/Shanghai");
    expect(formatted).toMatch(/13:06:07\.123$/);
  });
});

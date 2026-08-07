import { describe, expect, it } from "vitest";
import { formatDateTimeMilliseconds, formatLocalDateTime, isSupportedTimeZone, localDateTimeToDate } from "@/shared/date-time";

describe("millisecond date-time formatting", () => {
  it("renders exactly three fractional-second digits in the event time zone", () => {
    const formatted = formatDateTimeMilliseconds(new Date("2026-08-07T05:06:07.123Z"), "Asia/Shanghai");
    expect(formatted).toMatch(/13:06:07\.123$/);
  });
});

describe("event local date and time", () => {
  it("converts Shanghai wall-clock input to an absolute timestamp", () => {
    expect(localDateTimeToDate("2026-08-07", "19:30", "Asia/Shanghai")?.toISOString()).toBe("2026-08-07T11:30:00.000Z");
  });

  it("formats an event timestamp into separate date and time controls", () => {
    expect(formatLocalDateTime(new Date("2026-08-07T11:30:00.000Z"), "Asia/Shanghai")).toEqual({ date: "2026-08-07", time: "19:30" });
  });

  it("rejects unknown time zones and impossible local times", () => {
    expect(isSupportedTimeZone("Mars/Olympus")).toBe(false);
    expect(localDateTimeToDate("2026-02-30", "19:30", "Asia/Shanghai")).toBeNull();
  });
});

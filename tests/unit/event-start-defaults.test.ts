import { describe, expect, it } from "vitest";
import { eventStartDefaults } from "@/server/domain/event-start-defaults";

describe("eventStartDefaults", () => {
  it.each([
    ["2026-10-03T02:31:42.999Z", "2026-10-03", "10:35"],
    ["2026-10-03T02:30:00.000Z", "2026-10-03", "10:35"],
    ["2026-10-03T02:34:59.999Z", "2026-10-03", "10:35"],
    ["2026-10-03T02:59:59.999Z", "2026-10-03", "11:00"],
    ["2026-10-03T15:59:59.999Z", "2026-10-03", "00:00"],
    ["2026-10-03T16:00:00.000Z", "2026-10-04", "00:05"],
  ])("uses the local date and next five-minute time for %s", (instant, date, time) => {
    expect(eventStartDefaults(new Date(instant), "Asia/Shanghai")).toEqual({ date, time });
  });
});

import { describe, expect, it } from "vitest";
import {
  consecutiveTargetViolation,
  isConsecutiveTarget,
  type ConsecutiveEventConfiguration,
} from "@/server/domain/consecutive-checkin-config";

const source: ConsecutiveEventConfiguration = {
  id: "source",
  name: "第一场",
  status: "open",
  participationMode: "onsite",
  startsAt: new Date("2026-08-31T02:00:00.000Z"),
  timeZone: "Asia/Tokyo",
  locationId: "location",
};

function target(
  changes: Partial<ConsecutiveEventConfiguration> = {},
): ConsecutiveEventConfiguration {
  return {
    ...source,
    id: "target",
    name: "第二场",
    status: "draft",
    startsAt: new Date("2026-08-31T05:00:00.000Z"),
    ...changes,
  };
}

describe("consecutive check-in target rules", () => {
  it("accepts a later onsite event at the same location, time zone and local date", () => {
    expect(isConsecutiveTarget(source, target())).toBe(true);
  });

  it.each([
    ["TARGET_NOT_ONSITE", { participationMode: "preregistered" as const }],
    ["TARGET_ENDED", { status: "ended" as const }],
    ["TARGET_NOT_LATER", { startsAt: source.startsAt }],
    ["TARGET_LOCATION_MISMATCH", { locationId: "elsewhere" }],
    ["TARGET_TIME_ZONE_MISMATCH", { timeZone: "Asia/Shanghai" }],
    ["TARGET_DATE_MISMATCH", { startsAt: new Date("2026-09-01T05:00:00.000Z") }],
  ])("rejects %s", (violation, changes) => {
    expect(consecutiveTargetViolation(source, target(changes))).toBe(violation);
  });

  it("does not allow an event to target itself", () => {
    expect(isConsecutiveTarget(source, source)).toBe(false);
  });
});

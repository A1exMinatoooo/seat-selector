import { describe, expect, it } from "vitest";
import { eventConfigurationInputSchema } from "@/features/events/schemas";

const baseInput = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "八月观影会",
  locationId: "00000000-0000-4000-8000-000000000002",
  radiusMeters: "1000",
  startDate: "2026-08-07",
  startTime: "19:30",
  timeZone: "Asia/Shanghai",
  locationCheckEnabled: true,
  lotteryEnabled: false,
  ticketTypes: [{ id: "00000000-0000-4000-8000-000000000003", name: "普通票", lotteryEligible: false }],
  prizes: [],
};

describe("event configuration validation", () => {
  it("parses separate local date and time in the selected time zone", () => {
    const parsed = eventConfigurationInputSchema.parse(baseInput);
    expect(parsed.startsAt.toISOString()).toBe("2026-08-07T11:30:00.000Z");
  });

  it("requires lottery eligibility and a prize when lottery is enabled", () => {
    expect(eventConfigurationInputSchema.safeParse({ ...baseInput, lotteryEnabled: true }).success).toBe(false);
  });

  it("parses the activity-level location check switch", () => {
    expect(eventConfigurationInputSchema.parse({ ...baseInput, locationCheckEnabled: "on" }).locationCheckEnabled).toBe(true);
    expect(eventConfigurationInputSchema.parse({ ...baseInput, locationCheckEnabled: undefined }).locationCheckEnabled).toBe(false);
  });

  it("rejects lottery-eligible ticket types while lottery is disabled", () => {
    const ticketTypes = [{ ...baseInput.ticketTypes[0], lotteryEligible: true }];
    expect(eventConfigurationInputSchema.safeParse({ ...baseInput, ticketTypes }).success).toBe(false);
  });
});

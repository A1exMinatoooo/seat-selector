import { describe, expect, it } from "vitest";
import { uniqueDeviceParticipant } from "@/server/domain/participant-reentry";

describe("participant device re-entry", () => {
  it("restores the only participant bound to the device for an event", () => {
    const participant = { participantId: "participant-1" };
    expect(uniqueDeviceParticipant([participant])).toBe(participant);
  });

  it("does not guess when no participant or multiple participants match", () => {
    expect(uniqueDeviceParticipant([])).toBeNull();
    expect(uniqueDeviceParticipant([{ participantId: "one" }, { participantId: "two" }])).toBeNull();
  });
});

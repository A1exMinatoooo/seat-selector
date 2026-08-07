import { describe, expect, it } from "vitest";
import { canChangeEventStatus } from "@/server/domain/event-status";

describe("event status transitions", () => {
  it.each([
    ["draft", "open"],
    ["open", "ended"],
    ["ended", "open"],
  ] as const)("allows %s to change to %s", (from, to) => {
    expect(canChangeEventStatus(from, to)).toBe(true);
  });

  it.each([
    ["draft", "ended"],
    ["ended", "draft"],
    ["open", "draft"],
  ] as const)("rejects %s changing to %s", (from, to) => {
    expect(canChangeEventStatus(from, to)).toBe(false);
  });
});

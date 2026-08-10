import { describe, expect, it } from "vitest";
import { canChangeEventStatus, hasSufficientLotteryPool, lotteryPoolSize } from "@/server/domain/event-status";

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

describe("event lottery pool validation", () => {
  it("calculates the total pool from eligible tickets and bonus people", () => {
    expect(lotteryPoolSize(10, 5)).toBe(15);
  });

  it.each([
    [2, 1, 3],
    [4, 0, 3],
    [0, 0, 0],
  ])("accepts %i eligible tickets plus %i bonus people for %i prizes", (eligibleTicketCount, poolBonus, prizeCount) => {
    expect(hasSufficientLotteryPool(eligibleTicketCount, poolBonus, prizeCount)).toBe(true);
  });

  it("rejects opening when the prize inventory exceeds the total pool", () => {
    expect(hasSufficientLotteryPool(2, 1, 4)).toBe(false);
  });
});

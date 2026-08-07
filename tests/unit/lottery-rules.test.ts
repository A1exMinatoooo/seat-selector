import { describe, expect, it } from "vitest";
import { prizeIndexForRoll } from "@/server/domain/lottery-rules";

describe("prizeIndexForRoll", () => {
  it("maps prize inventory first and leaves the rest as no-win entries", () => {
    const prizes = [{ remaining: 2 }, { remaining: 1 }];
    expect(prizeIndexForRoll(prizes, 5, 0)).toBe(0);
    expect(prizeIndexForRoll(prizes, 5, 1)).toBe(0);
    expect(prizeIndexForRoll(prizes, 5, 2)).toBe(1);
    expect(prizeIndexForRoll(prizes, 5, 3)).toBeNull();
    expect(prizeIndexForRoll(prizes, 5, 4)).toBeNull();
  });

  it("rejects inventory larger than the remaining pool", () => {
    expect(() => prizeIndexForRoll([{ remaining: 3 }], 2, 1)).toThrow("exceeds");
  });
});

import { describe, expect, it } from "vitest";
import { userFacingErrorMessage } from "@/shared/error-message";

describe("user-facing error messages", () => {
  it("maps stable public codes to actionable Chinese messages", () => {
    expect(userFacingErrorMessage("SEAT_CONFLICT")).toContain("座位");
    expect(userFacingErrorMessage("LOTTERY_UNAVAILABLE")).toContain("抽奖");
  });

  it("does not expose unknown technical errors", () => {
    expect(userFacingErrorMessage("DatabaseError: password=secret")).toBe("操作失败，请稍后重试。");
  });
});

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ConsecutiveResultView } from "@/features/seating/consecutive-seat-flow";
import type { ConsecutiveWorkflowView } from "@/server/domain/consecutive-checkin-workflow";

const baseStep: ConsecutiveWorkflowView["steps"][number] = {
  eventId: "event-1",
  eventName: "第一场",
  lotteryEnabled: true,
  centerAfterColumn: null,
  ticketTotal: 1,
  historical: false,
  sortOrder: 0,
  tickets: [{ name: "普通票", quantity: 1, lotteryEligible: true }],
  confirmedAt: "2026-08-31T10:00:00.000Z",
  confirmedSeats: ["A1"],
  lotteryResults: [{ drawIndex: 0, prizeName: "海报" }],
  lotteryChances: 1,
  seats: [],
  availableSeatIds: [],
  occupiedSeatIds: [],
  selectedSeatIds: [],
};

describe("consecutive result view", () => {
  it("renders ordered, bordered event results and marks historical records", () => {
    const view: ConsecutiveWorkflowView = {
      id: "workflow-1",
      status: "completed",
      serverTime: "2026-08-31T10:00:00.000Z",
      claimedAt: "2026-08-31T09:55:00.000Z",
      hardExpiresAt: "2026-08-31T10:00:00.000Z",
      needsLocation: true,
      steps: [
        baseStep,
        {
          ...baseStep,
          eventId: "event-2",
          eventName: "第二场",
          historical: true,
          sortOrder: 1,
          confirmedSeats: ["B2"],
          lotteryResults: [],
        },
      ],
    };
    const markup = renderToStaticMarkup(createElement(ConsecutiveResultView, { view }));
    expect(markup.match(/consecutive-result-card/g)).toHaveLength(2);
    expect(markup).toContain("success-page consecutive-success-page");
    expect(markup).toContain("请截图保存本页");
    expect(markup).toContain("<h1>选座结果</h1>");
    expect(markup).not.toContain("同日活动结果");
    expect(markup).toContain("ticket-summary");
    expect(markup).toContain("lottery-prize-icon");
    expect(markup.indexOf("第一场")).toBeLessThan(markup.indexOf("第二场"));
    expect(markup).toContain("此前已完成");
    expect(markup).toContain("海报");
    expect(markup).toContain("B2");
  });
});

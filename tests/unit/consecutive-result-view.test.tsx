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
  it("preserves ordered results and shows historical seats without inventing lottery outcomes", () => {
    const view: ConsecutiveWorkflowView = {
      id: "workflow-1",
      status: "completed",
      serverTime: "2026-08-07T08:02:18.000Z",
      claimedAt: "2026-08-07T08:00:00.000Z",
      hardExpiresAt: "2026-08-07T08:05:00.000Z",
      needsLocation: true,
      steps: [
        { ...baseStep, eventName: "连续首场", confirmedAt: "2026-08-07T08:00:00.000Z", confirmedSeats: ["A排1座", "A排2座"], lotteryResults: [{ drawIndex: 0, prizeName: null }, { drawIndex: 1, prizeName: "海报" }] },
        { ...baseStep, eventId: "event-2", eventName: "连续后场", historical: true, sortOrder: 1, confirmedAt: "2026-08-07T07:00:00.000Z", confirmedSeats: ["B排8座"], lotteryResults: [] },
      ],
    };
    const markup = renderToStaticMarkup(createElement(ConsecutiveResultView, { view }));
    const firstEventPosition = markup.indexOf("连续首场");
    const historicalPosition = markup.indexOf("此前已完成");
    const historicalEventPosition = markup.indexOf("连续后场");
    const historicalMarkup = markup.slice(historicalPosition);

    expect(firstEventPosition).toBeGreaterThanOrEqual(0);
    expect(firstEventPosition).toBeLessThan(historicalPosition);
    expect(historicalEventPosition).toBeGreaterThan(historicalPosition);
    expect(markup).toContain("第 1 次：");
    expect(markup).toContain("未中奖");
    expect(markup).toContain("海报");
    expect(markup).toContain("A排1座");
    expect(markup).toContain("A排2座");
    expect(historicalMarkup).toContain("此前已完成");
    expect(historicalMarkup).toContain("B排8座");
    expect(historicalMarkup).not.toContain("抽奖结果");
  });
});

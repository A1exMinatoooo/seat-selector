import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SuccessView } from "@/features/seating/success-view";

describe("success view", () => {
  it("keeps every confirmed seat and each mixed lottery outcome visible", () => {
    const markup = renderToStaticMarkup(createElement(SuccessView, {
      code: "summer-screening",
      eventName: "午场",
      phoneLast4: "9002",
      confirmedAt: "2026-08-07T02:00:00.000Z",
      serverTime: "2026-08-07T02:02:18.000Z",
      seats: ["A排1座", "A排2座"],
      tickets: [{ name: "普通票", quantity: 2, lotteryEligible: true }],
      lotteryEnabled: true,
      initialLotteryResults: [{ drawIndex: 0, prizeName: null }, { drawIndex: 1, prizeName: "海报" }],
      showTodayRecordsLink: false,
    }));

    expect(markup).toContain("A排1座");
    expect(markup).toContain("A排2座");
    expect(markup).toContain("未中奖");
    expect(markup).toContain("海报");
    expect(markup).toContain("普通票");
    expect(markup).toContain("手机尾号");
    expect(markup).toContain("9002");
  });

  it("links to today's records when the device has at least two confirmations", () => {
    const markup = renderToStaticMarkup(createElement(SuccessView, {
      code: "summer-screening",
      eventName: "夏日放映",
      phoneLast4: "8000",
      confirmedAt: "2026-08-07T10:00:00.000Z",
      serverTime: "2026-08-07T10:00:00.000Z",
      seats: ["A1"],
      tickets: [{ name: "普通票", quantity: 1, lotteryEligible: false }],
      lotteryEnabled: false,
      initialLotteryResults: [],
      showTodayRecordsLink: true,
    }));
    expect(markup).toContain('href="/records/today"');
    expect(markup).toContain("查看今日选座记录");
  });

  it("shows the lottery prompt without theater manners when a draw is pending", () => {
    const markup = renderToStaticMarkup(createElement(SuccessView, {
      code: "summer-screening",
      eventName: "夏日放映",
      phoneLast4: "8000",
      confirmedAt: "2026-08-07T10:00:00.000Z",
      serverTime: "2026-08-07T10:00:00.000Z",
      seats: ["A1"],
      tickets: [{ name: "普通票", quantity: 1, lotteryEligible: true }],
      lotteryEnabled: true,
      initialLotteryResults: [],
      showTodayRecordsLink: false,
    }));

    expect(markup).toContain("您可参与 1 次抽奖");
    expect(markup).not.toContain("文明观影须知");
  });
});

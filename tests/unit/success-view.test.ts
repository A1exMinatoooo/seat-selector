import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SuccessView } from "@/features/seating/success-view";

describe("success view", () => {
  it("renders each confirmed seat on its own line", () => {
    const markup = renderToStaticMarkup(createElement(SuccessView, {
      code: "summer-screening",
      eventName: "夏日放映",
      phoneLast4: "8000",
      confirmedAt: "2026-08-07T10:00:00.000Z",
      serverTime: "2026-08-07T10:00:00.000Z",
      seats: ["A1", "A2"],
      tickets: [{ name: "普通票", quantity: 2, lotteryEligible: false }],
      lotteryEnabled: false,
      initialLotteryResults: [],
      showTodayRecordsLink: false,
    }));

    expect(markup).toContain('role="note">请截图保存本页，方便后续核对座位。</aside>');
    expect(markup).toContain('<header class="success-heading"><p class="eyebrow">选座成功</p><h1>夏日放映</h1></header>');
    expect(markup).toContain('<h2 class="confirmed-seats"><span class="confirmed-seat">A1</span><span class="confirmed-seat">A2</span></h2>');
    expect(markup).not.toContain("查看今日选座记录");
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
});

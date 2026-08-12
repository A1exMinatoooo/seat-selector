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

    expect(markup).toContain('class="success-notice" role="note"');
    expect(markup).toContain("请截图保存本页，方便后续核对座位。");
    expect(markup.match(/success-notice-icon/g)).toHaveLength(1);
    expect(markup).toContain('<header class="success-heading"><p class="eyebrow">选座成功</p><h1>夏日放映</h1></header>');
    expect(markup).toContain('<h2 class="confirmed-seats"><span class="confirmed-seat">A1</span><span class="confirmed-seat">A2</span></h2>');
    expect(markup).not.toContain("查看今日选座记录");
    expect(markup).toContain("文明观影须知");
    expect(markup).toContain("请将手机调至静音或震动状态，并调低亮度");
    expect(markup).toContain("龙标出现至结尾字幕结束，禁止录音/拍照/摄像");
    expect(markup).toContain("观影途中请保持安静，不要大声喧哗");
    expect(markup).toContain('disabled=""');
    expect(markup).toContain("我已知晓并同意 (5)");
    expect(markup).not.toContain("秒后可确认");
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

  it("decorates only winning prize names", () => {
    const markup = renderToStaticMarkup(createElement(SuccessView, {
      code: "summer-screening",
      eventName: "夏日放映",
      phoneLast4: "8000",
      confirmedAt: "2026-08-07T10:00:00.000Z",
      serverTime: "2026-08-07T10:00:00.000Z",
      seats: ["A1"],
      tickets: [{ name: "普通票", quantity: 1, lotteryEligible: true }],
      lotteryEnabled: true,
      initialLotteryResults: [{ drawIndex: 0, prizeName: "爆米花" }, { drawIndex: 1, prizeName: null }],
      showTodayRecordsLink: false,
    }));

    expect(markup.match(/lottery-prize-icon/g)).toHaveLength(1);
    expect(markup).toContain('<strong class="lottery-prize-name">未中奖</strong>');
    expect(markup).toMatch(/爆米花.*lottery-prize-icon/);
    expect(markup).toContain("文明观影须知");
  });

  it("shows the lottery prompt before theater manners when a draw is pending", () => {
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

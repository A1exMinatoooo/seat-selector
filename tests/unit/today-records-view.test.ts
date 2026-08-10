import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TodayRecordsView } from "@/features/records/today-records-view";

describe("today records view", () => {
  it("distinguishes a missing device from an empty day", () => {
    const missing = renderToStaticMarkup(createElement(TodayRecordsView, { date: "2026-08-07", devicePresent: false, records: [] }));
    const empty = renderToStaticMarkup(createElement(TodayRecordsView, { date: "2026-08-07", devicePresent: true, records: [] }));
    expect(missing).toContain("未识别到当前设备");
    expect(missing).toContain("同一微信");
    expect(empty).toContain("今日暂无选座记录");
    expect(empty).not.toContain("未识别到当前设备");
  });

  it("renders event, venue, seats, tickets, times, and lottery results", () => {
    const markup = renderToStaticMarkup(createElement(TodayRecordsView, {
      date: "2026-08-07",
      devicePresent: true,
      records: [{
        reservationId: "reservation-1",
        eventName: "夏日放映",
        cinemaName: "光影影院",
        hallName: "一号厅",
        startsAt: "2026-08-07T11:30:00.000Z",
        confirmedAt: "2026-08-07T10:00:00.000Z",
        seats: ["A排1座", "A排2座"],
        tickets: [{ name: "普通票", quantity: 2 }],
        lotteryResults: [{ drawIndex: 0, prizeName: null }, { drawIndex: 1, prizeName: "海报" }],
      }],
    }));
    expect(markup).toContain("夏日放映");
    expect(markup).toContain("光影影院 · 一号厅");
    expect(markup).toContain("A排1座、A排2座");
    expect(markup).toContain("普通票 × 2");
    expect(markup).toContain("未中奖");
    expect(markup).toContain("海报");
    expect(markup).toContain("19:30:00");
  });
});

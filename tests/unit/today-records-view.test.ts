// @vitest-environment jsdom

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
    expect(missing).toContain('role="status"');
    expect(missing).not.toContain("<article");
    expect(empty).toContain("今日暂无选座记录");
    expect(empty).not.toContain("未识别到当前设备");
    expect(empty).toContain('role="status"');
    expect(empty).not.toContain("<article");
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
    expect(markup).toContain("A排1座");
    expect(markup).toContain("A排2座");
    expect(markup).toContain("普通票 × 2");
    expect(markup).toContain("未中奖");
    expect(markup).toContain("海报");
    expect(markup).toContain("19:30:00");
  });

  it("keeps each ordered reservation and its own optional lottery results", () => {
    const markup = renderToStaticMarkup(createElement(TodayRecordsView, {
      date: "2026-08-07",
      devicePresent: true,
      records: [
        {
          reservationId: "reservation-first",
          eventName: "晚场",
          cinemaName: "影院甲",
          hallName: "一号厅",
          startsAt: "2026-08-07T12:00:00.000Z",
          confirmedAt: "2026-08-07T10:00:00.000Z",
          seats: ["B排8座"],
          tickets: [{ name: "学生票", quantity: 1 }],
          lotteryResults: [{ drawIndex: 0, prizeName: "海报" }],
        },
        {
          reservationId: "reservation-second",
          eventName: "午场",
          cinemaName: "影院乙",
          hallName: "二号厅",
          startsAt: "2026-08-07T04:00:00.000Z",
          confirmedAt: "2026-08-07T03:00:00.000Z",
          seats: ["A排1座"],
          tickets: [{ name: "普通票", quantity: 1 }],
          lotteryResults: [],
        },
      ],
    }));
    expect(markup.indexOf("晚场")).toBeLessThan(markup.indexOf("午场"));
    expect(markup).toContain("影院甲 · 一号厅");
    expect(markup).toContain("影院乙 · 二号厅");
    const tickets = new DOMParser().parseFromString(markup, "text/html").querySelectorAll("article");
    expect(tickets[0]?.textContent).toContain("海报");
    expect(tickets[1]?.textContent).not.toContain("海报");
    expect(tickets[1]?.querySelector('[aria-label="抽奖结果"]')).toBeNull();
  });
});

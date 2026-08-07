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
    }));

    expect(markup).toContain('<h1><span class="confirmed-seat">A1</span><span class="confirmed-seat">A2</span></h1>');
  });
});

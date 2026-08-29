import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EventPrizeInventory } from "@/features/events/event-prize-inventory";

describe("EventPrizeInventory", () => {
  it("renders total and remaining quantities for every prize", () => {
    const markup = renderToStaticMarkup(
      createElement(EventPrizeInventory, {
        prizes: [
          { id: "poster", name: "海报", total: 5, remaining: 3 },
          { id: "drink", name: "饮料", total: 2, remaining: 0 },
        ],
      }),
    );
    expect(markup).toContain("海报</strong><span>总数 5 · 剩余 3");
    expect(markup).toContain("饮料</strong><span>总数 2 · 剩余 0");
  });
});

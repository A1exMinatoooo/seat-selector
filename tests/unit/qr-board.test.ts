import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { QrBoard } from "@/features/entry/qr-board";

describe("onsite QR board", () => {
  it("recommends scanning with WeChat before the event details", () => {
    const markup = renderToStaticMarkup(
      createElement(QrBoard, {
        eventId: "event-1",
        eventName: "夏日放映",
        backHref: "/admin/events/event-1",
      }),
    );
    const noticePosition = markup.indexOf("建议使用微信扫描二维码");
    const headingPosition = markup.indexOf("夏日放映");
    expect(markup).toContain('class="qr-scan-notice" role="note"');
    expect(markup).toContain("lucide-arrow-left");
    expect(markup).toContain("后续可在同一微信中查看今日选座记录");
    expect(noticePosition).toBeGreaterThan(-1);
    expect(noticePosition).toBeLessThan(headingPosition);
  });
});

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BrandedQrCode } from "@/features/entry/branded-qr-code";

describe("branded QR code", () => {
  it("centers the decorative SVG logo over the scannable image", () => {
    const markup = renderToStaticMarkup(createElement(BrandedQrCode, { src: "data:image/png;base64,qr", alt: "测试二维码" }));

    expect(markup).toContain('class="branded-qr-code"');
    expect(markup).toContain('class="branded-qr-code-image"');
    expect(markup).toContain('class="branded-qr-code-logo"');
    expect(markup).toContain('src="/icon.svg"');
    expect(markup).toContain('alt="测试二维码"');
    expect(markup).toContain('aria-hidden="true"');
  });
});

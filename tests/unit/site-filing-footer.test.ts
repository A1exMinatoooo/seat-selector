import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FilingFooterContent } from "@/features/footer/site-filing-footer";
import { publicFilingConfigFromEnv } from "@/shared/public-filing-config";

function render(values: Parameters<typeof publicFilingConfigFromEnv>[0]) {
  return renderToStaticMarkup(
    createElement(FilingFooterContent, { config: publicFilingConfigFromEnv(values) }),
  );
}

describe("site filing footer", () => {
  it("does not render an empty footer", () => {
    expect(render({})).toBe("");
    expect(render({ ICP_FILING_NUMBER: "  " })).toBe("");
  });

  it("renders ICP filing with the fixed ministry link", () => {
    const markup = render({ ICP_FILING_NUMBER: "粤ICP备12345678号" });
    expect(markup).toContain("https://beian.miit.gov.cn/");
    expect(markup).toContain("粤ICP备12345678号");
    expect(markup).toContain('rel="noopener noreferrer"');
  });

  it("renders public security filing as text without a URL", () => {
    const markup = render({ PUBLIC_SECURITY_FILING_NUMBER: "粤公网安备 123456号" });
    expect(markup).toContain("<span>粤公网安备 123456号</span>");
  });

  it("renders both filings and links the public security filing when configured", () => {
    const markup = render({
      ICP_FILING_NUMBER: "粤ICP备12345678号",
      PUBLIC_SECURITY_FILING_NUMBER: "粤公网安备 123456号",
      PUBLIC_SECURITY_FILING_URL:
        "https://www.beian.gov.cn/portal/registerSystemInfo?recordcode=123456",
    });
    expect(markup).toContain("粤ICP备12345678号");
    expect(markup).toContain("粤公网安备 123456号");
    expect(markup).toContain(
      "https://www.beian.gov.cn/portal/registerSystemInfo?recordcode=123456",
    );
  });

  it("returns only the public filing allowlist", () => {
    const config = publicFilingConfigFromEnv({
      ICP_FILING_NUMBER: "ICP",
      PUBLIC_SECURITY_FILING_NUMBER: "公安",
      PUBLIC_SECURITY_FILING_URL: "https://example.com/filing",
    });
    expect(Object.keys(config).sort()).toEqual([
      "icpFilingNumber",
      "publicSecurityFilingNumber",
      "publicSecurityFilingUrl",
    ]);
  });
});

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  HallTemplateExportMenu,
  HallTemplateGroups,
} from "@/features/venues/hall-template-navigation";

describe("hall template navigation", () => {
  const cinemas = [
    { id: "cinema-a", name: "甲影院", hallCount: 2 },
    { id: "cinema-b", name: "乙影院", hallCount: 1 },
  ];

  it("renders cinema groups collapsed by default with template counts", () => {
    const markup = renderToStaticMarkup(
      createElement(HallTemplateGroups, {
        groups: cinemas.map((cinema) => ({
          ...cinema,
          content: createElement(
            "a",
            { href: `/api/admin/venues/export?scope=hall&id=${cinema.id}-hall` },
            `${cinema.name}影厅导出`,
          ),
        })),
      }),
    );

    expect(markup.match(/<details>/g)).toHaveLength(2);
    expect(markup).not.toContain("<details open");
    expect(markup).toContain("甲影院");
    expect(markup).toContain("2 个影厅模板");
    expect(markup.match(/lucide-chevron-down/g)).toHaveLength(2);
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain("scope=hall&amp;id=cinema-a-hall");
    expect(markup.indexOf("甲影院")).toBeLessThan(markup.indexOf("乙影院"));
  });

  it("renders all and per-cinema exports in a single menu", () => {
    const markup = renderToStaticMarkup(createElement(HallTemplateExportMenu, { cinemas }));

    expect(markup).toContain('aria-label="导出影厅模板"');
    expect(markup).toContain('href="/api/admin/venues/export?scope=all"');
    expect(markup).toContain('href="/api/admin/venues/export?scope=cinema&amp;id=cinema-a"');
    expect(markup).toContain('href="/api/admin/venues/export?scope=cinema&amp;id=cinema-b"');
    expect(markup).toContain("按影院导出");
    expect(markup).toContain("lucide-chevron-down");
  });
});

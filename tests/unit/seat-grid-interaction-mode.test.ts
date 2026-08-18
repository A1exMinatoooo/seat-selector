import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  EventSeatEditor,
  gridPointerPosition,
  seatsIntersectingRectangle,
} from "@/features/events/event-seat-editor";
import { SeatGridViewport } from "@/features/seating/seat-grid-viewport";
import { SeatLayoutEditor, toggleSeatLayoutTool } from "@/features/venues/seat-layout-editor";

describe("seat grid interaction modes", () => {
  it("defaults both editors to the navigation-only mode", () => {
    const eventEditor = renderToStaticMarkup(
      createElement(EventSeatEditor, {
        halls: [
          {
            id: "hall-1",
            cinemaId: "cinema-1",
            cinemaName: "甲影院",
            hallName: "一号厅",
            seats: [
              {
                id: "seat-1",
                rowIndex: 0,
                columnIndex: 0,
                rowLabel: "A",
                columnLabel: "1",
                kind: "seat",
                selectable: true,
                golden: false,
              },
            ],
          },
        ],
        initialHallId: "hall-1",
      }),
    );
    const layoutEditor = renderToStaticMarkup(createElement(SeatLayoutEditor));

    for (const markup of [eventEditor, layoutEditor]) {
      expect(markup).toMatch(/<button[^>]*aria-pressed="true"[^>]*>无修改<\/button>/);
      expect(markup).toContain("gestures-enabled");
      expect(markup).toContain("单指拖动可移动网格，双指可缩放");
    }
  });

  it("returns transient numbering tools to navigation mode when stopped", () => {
    expect(toggleSeatLayoutTool("navigate", "number")).toBe("number");
    expect(toggleSeatLayoutTool("number", "number")).toBe("navigate");
    expect(toggleSeatLayoutTool("clear-number", "clear-number")).toBe("navigate");
  });

  it("disables gestures without disabling the zoom toolbar", () => {
    const props: Parameters<typeof SeatGridViewport>[0] = {
      children: "内容",
      ariaLabel: "测试网格",
      gesturesEnabled: false,
      interactionHint: createElement("p", null, "操作提示"),
    };
    const markup = renderToStaticMarkup(
      createElement(SeatGridViewport, props),
    );

    expect(markup).toContain("gestures-disabled");
    expect(markup).toContain('aria-label="缩小座位网格"');
    expect(markup).toContain('aria-label="放大座位网格"');
    expect(markup).toContain("显示完整");
    expect(markup.indexOf("显示完整")).toBeLessThan(markup.indexOf("操作提示"));
    expect(markup.indexOf("操作提示")).toBeLessThan(markup.indexOf("seat-grid-viewport-body"));
  });

  it("renders the optional mobile navigation minimap as non-interactive", () => {
    const props: Parameters<typeof SeatGridViewport>[0] = {
      children: createElement("button", null, "A1"),
      ariaLabel: "测试网格",
      mobileMinimap: true,
    };
    const markup = renderToStaticMarkup(createElement(SeatGridViewport, props));

    expect(markup).toContain("seat-grid-minimap");
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain("inert");
  });

  it("shows planning tools only when explicitly enabled", () => {
    const hall = {
      id: "hall-1",
      cinemaId: "cinema-1",
      cinemaName: "甲影院",
      hallName: "一号厅",
      seats: [
        {
          id: "seat-1",
          rowIndex: 0,
          columnIndex: 0,
          rowLabel: "A",
          columnLabel: "1",
          kind: "seat" as const,
          selectable: true,
          golden: false,
        },
      ],
    };
    const enabled = renderToStaticMarkup(
      createElement(EventSeatEditor, {
        halls: [hall],
        initialHallId: hall.id,
        planningToolsEnabled: true,
      }),
    );
    const disabled = renderToStaticMarkup(
      createElement(EventSeatEditor, { halls: [hall], initialHallId: hall.id }),
    );

    expect(enabled).toContain("按数量开放");
    expect(enabled).toContain("矩形框选开放");
    expect(enabled).toContain('aria-pressed="false"');
    expect(disabled).not.toContain("按数量开放");
    expect(disabled).not.toContain("矩形框选开放");
  });

  it("groups hall options under non-selectable cinema labels", () => {
    const seat = {
      id: "seat-1",
      rowIndex: 0,
      columnIndex: 0,
      rowLabel: "A",
      columnLabel: "1",
      kind: "seat" as const,
      selectable: true,
      golden: false,
    };
    const markup = renderToStaticMarkup(
      createElement(EventSeatEditor, {
        halls: [
          {
            id: "hall-a1",
            cinemaId: "cinema-a",
            cinemaName: "甲影院",
            hallName: "1号厅",
            seats: [seat],
          },
          {
            id: "hall-a2",
            cinemaId: "cinema-a",
            cinemaName: "甲影院",
            hallName: "2号厅",
            seats: [{ ...seat, id: "seat-2" }],
          },
          {
            id: "hall-b1",
            cinemaId: "cinema-b",
            cinemaName: "乙影院",
            hallName: "IMAX厅",
            seats: [{ ...seat, id: "seat-3" }],
          },
        ],
        initialHallId: "hall-a1",
        includeHallSelect: true,
      }),
    );

    expect(markup).toContain('<optgroup label="甲影院">');
    expect(markup).toContain('<optgroup label="乙影院">');
    expect(markup).toMatch(/<option[^>]*value="hall-a1"[^>]*>1号厅<\/option>/);
    expect(markup).toMatch(/<option[^>]*value="hall-a2"[^>]*>2号厅<\/option>/);
    expect(markup).not.toContain("甲影院 · 1号厅");
    expect(markup.indexOf("甲影院")).toBeLessThan(markup.indexOf("乙影院"));
  });

  it("maps pointer positions through zoom and selects only eligible intersecting seats", () => {
    expect(
      gridPointerPosition(150, 100, { left: 100, top: 50, right: 300, bottom: 150 }, 400, 200),
    ).toEqual({ x: 100, y: 100 });
    const seats = [
      { id: "available", eligible: true, left: 20, top: 20, right: 56, bottom: 56 },
      { id: "structural", eligible: false, left: 60, top: 20, right: 96, bottom: 56 },
      { id: "outside", eligible: true, left: 120, top: 20, right: 156, bottom: 56 },
    ];
    expect(
      seatsIntersectingRectangle({ left: 10, top: 10, right: 100, bottom: 70 }, seats),
    ).toEqual(["available"]);
  });
});

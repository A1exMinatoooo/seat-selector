// @vitest-environment jsdom

import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SeatLayoutEditor } from "@/features/venues/seat-layout-editor";
import { EventSeatEditor } from "@/features/events/event-seat-editor";

vi.mock("@/features/seating/seat-grid-viewport", () => ({
  SeatGridViewport: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

afterEach(cleanup);
const cells = Array.from({ length: 10 }, (_, columnIndex) => ({
  id: `seat-${columnIndex}`,
  rowIndex: 0,
  columnIndex,
  rowLabel: "A",
  columnLabel: String(columnIndex + 1),
  kind: "seat" as const,
  selectable: true,
  golden: false,
}));

describe("seat center configuration", () => {
  it("updates an automatic center when columns change while preserving null in the payload", () => {
    const { container } = render(
      <SeatLayoutEditor initialLayout={{ rows: 1, columns: 10, centerAfterColumn: null, cells }} />,
    );
    const center = () =>
      screen.getByRole<HTMLInputElement>("spinbutton", { name: "中线位于第几列后" });
    expect(center().value).toBe("5");
    fireEvent.change(screen.getByRole("spinbutton", { name: "列数" }), {
      target: { value: "9" },
    });
    expect(center().value).toBe("4");
    expect(
      JSON.parse(container.querySelector<HTMLInputElement>('input[name="layout"]')!.value)
        .centerAfterColumn,
    ).toBeNull();
    fireEvent.change(screen.getByRole("spinbutton", { name: "列数" }), {
      target: { value: "1" },
    });
    expect(center().value).toBe("0");
  });

  it("preserves configured centers and clamps them when the grid shrinks", () => {
    const { container } = render(
      <SeatLayoutEditor initialLayout={{ rows: 1, columns: 10, centerAfterColumn: 7, cells }} />,
    );
    expect(
      screen.getByRole<HTMLInputElement>("spinbutton", { name: "中线位于第几列后" }).value,
    ).toBe("8");
    fireEvent.change(screen.getByRole("spinbutton", { name: "列数" }), {
      target: { value: "5" },
    });
    expect(
      screen.getByRole<HTMLInputElement>("spinbutton", { name: "中线位于第几列后" }).value,
    ).toBe("5");
    expect(
      JSON.parse(container.querySelector<HTMLInputElement>('input[name="layout"]')!.value)
        .centerAfterColumn,
    ).toBe(4);
  });

  it("uses each selected hall's center for half locks, including null overriding a legacy prop", async () => {
    const user = userEvent.setup();
    const hall = {
      id: "a",
      cinemaId: "cinema",
      cinemaName: "测试影院",
      hallName: "一号厅",
      centerAfterColumn: 2,
      seats: cells,
    };
    render(
      <EventSeatEditor
        halls={[
          hall,
          { ...hall, id: "b", hallName: "二号厅", centerAfterColumn: 6 },
          { ...hall, id: "c", hallName: "默认中线厅", centerAfterColumn: null },
        ]}
        initialHallId="a"
        initialLockedSeatHalf="left"
        centerAfterColumn={8}
        includeHallSelect
      />,
    );
    expect(screen.getByRole("button", { name: "A排5座：基础开放" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /测试影院 · 一号厅/ }));
    await user.click(screen.getByRole("option", { name: "二号厅" }));
    expect(screen.getByRole("button", { name: "A排5座：半场锁定" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /测试影院 · 二号厅/ }));
    await user.click(screen.getByRole("option", { name: "默认中线厅" }));
    expect(screen.getByRole("button", { name: "A排6座：基础开放" })).toBeTruthy();
  });
});

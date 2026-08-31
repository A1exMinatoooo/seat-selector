// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SeatPicker } from "@/features/seating/seat-picker";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

class ResizeObserverStub {
  observe() {}
  disconnect() {}
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 204 })),
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("SeatPicker toast", () => {
  it("shows the pinch hint after manners and replaces its timer with newer feedback", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    render(
      <SeatPicker
        code="summer-screening"
        eventName="夏日放映"
        seats={[
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
          {
            id: "seat-2",
            rowIndex: 0,
            columnIndex: 1,
            rowLabel: "A",
            columnLabel: "2",
            kind: "seat",
            selectable: true,
            golden: false,
          },
        ]}
        initialAvailable={["seat-1"]}
        initialOccupied={["seat-1"]}
        initialVersion={1}
        ticketTotal={1}
        centerAfterColumn={null}
        skipLocationCheck
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "关闭" }));
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "start" });
    expect(screen.getByRole("status").textContent).toBe("双指可放大缩小座位图");
    act(() => vi.advanceTimersByTime(1_000));
    const occupied = screen.getByRole("button", { name: "A排1座：已被他人选择" });
    const blocked = screen.getByRole("button", { name: "A排2座：不可选" });
    expect(occupied.className).toContain("occupied");
    expect(blocked.className).toContain("blocked");
    expect(
      occupied.querySelector('[data-seat-state-icon="occupied"]')?.classList.contains("lucide-x"),
    ).toBe(true);
    expect(
      blocked.querySelector('[data-seat-state-icon="blocked"]')?.classList.contains("lucide-ban"),
    ).toBe(true);
    expect(occupied.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(blocked.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    fireEvent.click(occupied);
    expect(screen.getByRole("status").textContent).toBe("这个座位已被其他参与者选择。");
    act(() => vi.advanceTimersByTime(1_600));
    expect(screen.getByRole("status").textContent).toBe("这个座位已被其他参与者选择。");
    act(() => vi.advanceTimersByTime(1_000));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("preserves the current selection and unlocks submit after a network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).endsWith("/confirm")) throw new TypeError("Failed to fetch");
        return new Response(null, { status: 204 });
      }),
    );
    render(
      <SeatPicker
        code="summer-screening"
        eventName="夏日放映"
        seats={[{
          id: "seat-1",
          rowIndex: 0,
          columnIndex: 0,
          rowLabel: "A",
          columnLabel: "1",
          kind: "seat",
          selectable: true,
          golden: false,
        }]}
        initialAvailable={["seat-1"]}
        initialOccupied={[]}
        initialVersion={1}
        ticketTotal={1}
        centerAfterColumn={null}
        skipLocationCheck
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "关闭" }));
    fireEvent.click(screen.getByRole("button", { name: "A排1座：可选" }));
    fireEvent.click(screen.getByRole("button", { name: "确认选座" }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByRole("status").textContent).toContain("已保留当前选择");
    expect(screen.getByText("已选 1/1")).toBeTruthy();
    expect(screen.getByRole("button", { name: "确认选座" }).hasAttribute("disabled")).toBe(false);
  });
});

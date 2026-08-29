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
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("SeatPicker toast", () => {
  it("shows the pinch hint after manners and replaces its timer with newer feedback", () => {
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
        initialOccupied={["seat-1"]}
        initialVersion={1}
        ticketTotal={1}
        centerAfterColumn={null}
        skipLocationCheck
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "关闭" }));
    expect(screen.getByRole("status").textContent).toBe("双指可放大缩小座位图");
    act(() => vi.advanceTimersByTime(1_000));
    fireEvent.click(screen.getByRole("button", { name: "A排1座" }));
    expect(screen.getByRole("status").textContent).toBe("这个座位已被其他参与者选择。");
    act(() => vi.advanceTimersByTime(1_600));
    expect(screen.getByRole("status").textContent).toBe("这个座位已被其他参与者选择。");
    act(() => vi.advanceTimersByTime(1_000));
    expect(screen.queryByRole("status")).toBeNull();
  });
});

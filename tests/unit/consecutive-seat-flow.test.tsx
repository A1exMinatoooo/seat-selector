// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConsecutiveSeatFlow } from "@/features/seating/consecutive-seat-flow";
import type { ConsecutiveWorkflowView } from "@/server/domain/consecutive-checkin-workflow";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/features/seating/seat-grid-viewport", () => ({
  SeatGridViewport: ({ children, legend }: { children: React.ReactNode; legend?: React.ReactNode }) => <div data-testid="seat-grid-scroll-area">{legend}{children}</div>,
}));
vi.mock("@/features/seating/theater-manners-dialog", () => ({ TheaterMannersDialog: () => null }));

function step(eventId: string, eventName: string, sortOrder: number, lotteryEnabled = false) {
  return {
    eventId,
    eventName,
    lotteryEnabled,
    centerAfterColumn: null,
    ticketTotal: 1,
    historical: false,
    sortOrder,
    tickets: [{ name: "普通票", quantity: 1, lotteryEligible: lotteryEnabled }],
    confirmedAt: null,
    confirmedSeats: [],
    lotteryResults: [],
    lotteryChances: lotteryEnabled ? 1 : 0,
    seats: [{ id: `${eventId}-seat`, rowIndex: 0, columnIndex: 0, rowLabel: "A", columnLabel: "1", kind: "seat" as const, selectable: true, golden: false }],
    availableSeatIds: [`${eventId}-seat`],
    occupiedSeatIds: [],
    selectedSeatIds: [],
  };
}

function view(): ConsecutiveWorkflowView {
  return {
    id: "workflow-1",
    status: "active",
    serverTime: new Date().toISOString(),
    claimedAt: new Date().toISOString(),
    hardExpiresAt: new Date(Date.now() + 300_000).toISOString(),
    needsLocation: false,
    steps: [step("event-1", "第一场", 0), step("event-2", "第二场", 1, true)],
  };
}

beforeEach(() => {
  refresh.mockReset();
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/holds") && init?.method !== "PUT")
      return new Response(JSON.stringify({ occupiedSeatIds: [], selectedSeatIds: [] }));
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("ConsecutiveSeatFlow", () => {
  it("uses read-only progress and one sequential action", async () => {
    render(<ConsecutiveSeatFlow code="ABC123" initialView={view()} />);
    expect(screen.getByRole("list", { name: "连签活动进度" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /第一场/ })).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "提交并选下一场" })).toBeTruthy();
    expect(screen.getByLabelText("参与者座位图图例")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "A排1座：可选" }));
    fireEvent.click(screen.getByRole("button", { name: "提交并选下一场" }));

    await waitFor(() => expect(screen.getByRole("heading", { name: "第二场" })).toBeTruthy());
    expect(screen.getByRole("button", { name: "提交选座" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /第一场/ })).toBeNull();
  });

  it("restores fully held legacy workflows at the lottery prompt", () => {
    const restored = view();
    restored.steps = restored.steps.map((item) => ({ ...item, selectedSeatIds: [`${item.eventId}-seat`] }));
    render(<ConsecutiveSeatFlow code="ABC123" initialView={restored} />);
    expect(screen.getByRole("heading", { name: "您可参与 1 次抽奖" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "确定，开始抽奖" })).toBeTruthy();
  });

  it("shows current event context only after its title leaves the viewport", () => {
    render(<ConsecutiveSeatFlow code="ABC123" initialView={view()} />);
    const title = screen.getByRole("heading", { name: "第一场" });
    vi.spyOn(title, "getBoundingClientRect").mockReturnValue({ bottom: -1 } as DOMRect);
    Object.defineProperty(window, "scrollY", { configurable: true, value: 120 });

    expect(screen.queryByText("正在选")).toBeNull();
    fireEvent.scroll(screen.getByTestId("seat-grid-scroll-area"));
    expect(screen.queryByText("正在选")).toBeNull();

    fireEvent.scroll(window);
    expect(screen.getByText("正在选").parentElement?.textContent).toMatch(/^正在选第一场，剩余 \d+ 秒$/);

    Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
    fireEvent.scroll(window);
    expect(screen.queryByText("正在选")).toBeNull();
  });

  it("keeps the scroll position and updates the notice for the next event", async () => {
    render(<ConsecutiveSeatFlow code="ABC123" initialView={view()} />);
    Object.defineProperty(window, "scrollY", { configurable: true, value: 120 });
    const firstTitle = screen.getByRole("heading", { name: "第一场" });
    vi.spyOn(firstTitle, "getBoundingClientRect").mockReturnValue({ bottom: -1 } as DOMRect);
    fireEvent.scroll(window);

    fireEvent.click(screen.getByRole("button", { name: "A排1座：可选" }));
    fireEvent.click(screen.getByRole("button", { name: "提交并选下一场" }));

    const secondTitle = await screen.findByRole("heading", { name: "第二场" });
    vi.spyOn(secondTitle, "getBoundingClientRect").mockReturnValue({ bottom: -1 } as DOMRect);
    fireEvent.resize(window);
    expect(window.scrollY).toBe(120);
    expect(screen.getByText("正在选").parentElement?.textContent).toMatch(/^正在选第二场，剩余 \d+ 秒$/);
  });

  it("updates the remaining time in the floating notice", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-31T10:00:00.000Z"));
    render(<ConsecutiveSeatFlow code="ABC123" initialView={view()} />);
    Object.defineProperty(window, "scrollY", { configurable: true, value: 120 });
    const title = screen.getByRole("heading", { name: "第一场" });
    vi.spyOn(title, "getBoundingClientRect").mockReturnValue({ bottom: -1 } as DOMRect);
    fireEvent.scroll(window);
    expect(screen.getByText("，剩余 300 秒")).toBeTruthy();

    act(() => vi.advanceTimersByTime(1_000));
    expect(screen.getByText("，剩余 299 秒")).toBeTruthy();
  });

  it("preserves the current step selection and unlocks submit after a network failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/holds") && init?.method === "PUT")
        throw new TypeError("Failed to fetch");
      if (url.includes("/holds"))
        return Response.json({ occupiedSeatIds: [], selectedSeatIds: [] });
      return Response.json({ ok: true });
    }));
    render(<ConsecutiveSeatFlow code="ABC123" initialView={view()} />);
    fireEvent.click(screen.getByRole("button", { name: "A排1座：可选" }));
    fireEvent.click(screen.getByRole("button", { name: "提交并选下一场" }));

    expect((await screen.findByRole("alert")).textContent).toContain("已保留当前选择");
    expect(screen.getByText("已选 1/1")).toBeTruthy();
    expect(screen.getByRole("button", { name: "提交并选下一场" }).hasAttribute("disabled")).toBe(false);
  });
});

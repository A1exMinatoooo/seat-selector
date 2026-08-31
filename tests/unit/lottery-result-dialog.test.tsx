// @vitest-environment jsdom

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LotteryResultDialog } from "@/features/seating/success-view";
import { ConsecutiveLotteryResultDialog } from "@/features/seating/consecutive-seat-flow";
import type { ConsecutiveWorkflowView } from "@/server/domain/consecutive-checkin-workflow";

afterEach(() => {
  vi.useRealTimers();
});

describe("LotteryResultDialog", () => {
  const results = [{ drawIndex: 0, prizeName: "海报" }];

  it("shows a countdown while allowing immediate close", () => {
    const onClose = vi.fn();
    render(<LotteryResultDialog results={results} onClose={onClose} />);
    expect(screen.getByRole("button", { name: "关闭（3）" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "关闭（3）" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes automatically at three seconds and cleans up", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const view = render(<LotteryResultDialog results={results} onClose={onClose} />);
    act(() => vi.advanceTimersByTime(1_000));
    expect(screen.getByRole("button", { name: "关闭（2）" })).toBeTruthy();
    act(() => vi.advanceTimersByTime(1_999));
    expect(onClose).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onClose).toHaveBeenCalledOnce();
    view.unmount();
    act(() => vi.runAllTimers());
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe("ConsecutiveLotteryResultDialog", () => {
  it("groups results by event and waits for an explicit close", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const baseStep: ConsecutiveWorkflowView["steps"][number] = {
      eventId: "event-1",
      eventName: "第一场",
      lotteryEnabled: true,
      centerAfterColumn: null,
      ticketTotal: 1,
      historical: false,
      sortOrder: 0,
      tickets: [{ name: "普通票", quantity: 1, lotteryEligible: true }],
      confirmedAt: "2026-08-31T10:00:00.000Z",
      confirmedSeats: ["A排1座"],
      lotteryResults: [{ drawIndex: 0, prizeName: "海报" }],
      lotteryChances: 1,
      seats: [],
      availableSeatIds: [],
      occupiedSeatIds: [],
      selectedSeatIds: [],
    };
    render(
      <ConsecutiveLotteryResultDialog
        steps={[
          baseStep,
          { ...baseStep, eventId: "event-2", eventName: "第二场", sortOrder: 1, lotteryResults: [{ drawIndex: 0, prizeName: null }] },
        ]}
        onClose={onClose}
      />,
    );
    expect(screen.getByRole("heading", { name: "第一场" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "第二场" })).toBeTruthy();
    act(() => vi.advanceTimersByTime(10_000));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "关闭" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

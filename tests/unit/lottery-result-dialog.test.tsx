// @vitest-environment jsdom

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LotteryResultDialog } from "@/features/seating/success-view";

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

// @vitest-environment jsdom

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TheaterMannersDialog } from "@/features/seating/theater-manners-dialog";

afterEach(() => {
  vi.useRealTimers();
});

describe("TheaterMannersDialog", () => {
  it("can close immediately", () => {
    const onClose = vi.fn();
    render(<TheaterMannersDialog onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "关闭" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes automatically after three seconds and clears its timer", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const view = render(<TheaterMannersDialog onClose={onClose} />);
    act(() => vi.advanceTimersByTime(2_999));
    expect(onClose).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onClose).toHaveBeenCalledOnce();
    view.unmount();
    act(() => vi.runAllTimers());
    expect(onClose).toHaveBeenCalledOnce();
  });
});

// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RedeemClient } from "@/features/entry/redeem-client";

const navigation = vi.hoisted(() => ({
  router: { replace: vi.fn() },
}));

vi.mock("next/navigation", () => ({ useRouter: () => navigation.router }));

beforeEach(() => {
  navigation.router.replace.mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("RedeemClient", () => {
  it("shows a non-dismissible completed dialog and links to today's records", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ error: "SELECTION_ALREADY_COMPLETED" }, { status: 409 }),
      ),
    );

    render(<RedeemClient code="summer-screening" token="valid-ticket-token" />);

    const dialog = await screen.findByRole("dialog", { name: "您已完成本场选座" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(screen.queryByRole("button", { name: "关闭" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "查看选座记录（5）" }));
    expect(navigation.router.replace).toHaveBeenCalledWith("/records/today");
  });

  it("automatically replaces the entry route after five seconds and clears timers", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ error: "SELECTION_ALREADY_COMPLETED" }, { status: 409 }),
      ),
    );

    const view = render(<RedeemClient code="summer-screening" token="valid-ticket-token" />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByRole("dialog", { name: "您已完成本场选座" })).toBeTruthy();

    act(() => vi.advanceTimersByTime(4_000));
    expect(screen.getByText("1 秒后将自动跳转至选座记录。")).toBeTruthy();
    expect(navigation.router.replace).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1_000));
    expect(navigation.router.replace).toHaveBeenCalledWith("/records/today");

    navigation.router.replace.mockClear();
    view.unmount();
    act(() => vi.advanceTimersByTime(5_000));
    expect(navigation.router.replace).not.toHaveBeenCalled();
  });

  it("shows the stable QR error instead of collapsing every failure into expiry", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ error: "TICKET_ISSUE_CLAIMED" }, { status: 409 })),
    );

    render(<RedeemClient code="summer-screening" token="claimed-ticket-token" />);

    expect(await screen.findByRole("heading", { name: "二维码已被领取" })).toBeTruthy();
    expect(screen.getByText("二维码已被领取或失效，请让发起者重新发行。")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "重新验证" })).toBeNull();
  });

  it("keeps the page recoverable when the network fails", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    render(<RedeemClient code="summer-screening" token="valid-ticket-token" />);

    expect(await screen.findByText("网络连接失败，请检查网络后重试。")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "重新验证" }));
    await waitFor(() =>
      expect(navigation.router.replace).toHaveBeenCalledWith("/e/summer-screening"),
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

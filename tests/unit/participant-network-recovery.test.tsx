// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConsecutiveSessionRestore } from "@/features/entry/consecutive-session-restore";
import { ParticipantSessionRestore } from "@/features/entry/participant-session-restore";
import { LocationGate } from "@/features/seating/location-gate";

const navigation = vi.hoisted(() => ({ router: { refresh: vi.fn() } }));

vi.mock("next/navigation", () => ({ useRouter: () => navigation.router }));
vi.mock("@/features/seating/location-audit", () => ({
  reportBrowserLocationFailure: vi.fn(),
}));

beforeEach(() => {
  navigation.router.refresh.mockReset();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("participant network recovery", () => {
  it("unlocks location verification after a network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    vi.stubGlobal("navigator", {
      ...window.navigator,
      geolocation: {
        getCurrentPosition: (success: PositionCallback) => success({
          coords: { latitude: 1, longitude: 2, accuracy: 3 },
          timestamp: Date.now(),
        } as GeolocationPosition),
      },
    });

    render(<LocationGate code="summer-screening" eventName="夏日放映" />);
    fireEvent.click(screen.getByRole("button", { name: "允许定位并进入" }));

    expect((await screen.findByRole("alert")).textContent).toContain("网络连接失败");
    expect(screen.getByRole("button", { name: "允许定位并进入" }).hasAttribute("disabled")).toBe(false);
  });

  it.each([
    ["选座", ParticipantSessionRestore],
    ["连签", ConsecutiveSessionRestore],
  ] as const)("lets the participant manually retry %s session restoration", async (_label, Restore) => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    render(<Restore code="summer-screening" eventName="夏日放映" />);
    expect(await screen.findByText("网络连接失败，请检查网络后重试。")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "重新恢复" }));

    await waitFor(() => expect(navigation.router.refresh).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminToastProvider, useAdminToast } from "@/features/admin/admin-toast";

const navigation = vi.hoisted(() => ({
  pathname: "/admin/events/event-1",
  searchParams: new URLSearchParams(),
  replace: vi.fn(),
  router: { replace: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => navigation.router,
  useSearchParams: () => navigation.searchParams,
}));

function ToastControls() {
  const showToast = useAdminToast();
  return (
    <>
      <button onClick={() => showToast("success", "保存成功")}>成功</button>
      <button onClick={() => showToast("error", "保存失败")}>失败</button>
    </>
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  navigation.searchParams = new URLSearchParams();
  navigation.router.replace.mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("AdminToastProvider", () => {
  it("uses accessible roles and lets newer feedback replace the previous timer", () => {
    render(
      <AdminToastProvider>
        <ToastControls />
      </AdminToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "成功" }));
    expect(screen.getByRole("status").textContent).toBe("保存成功");
    act(() => vi.advanceTimersByTime(3_000));
    fireEvent.click(screen.getByRole("button", { name: "失败" }));
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("alert").textContent).toBe("保存失败");
    act(() => vi.advanceTimersByTime(3_900));
    expect(screen.getByRole("alert")).toBeTruthy();
    act(() => vi.advanceTimersByTime(100));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("maps a controlled cross-page notice and removes only that query parameter", () => {
    navigation.searchParams = new URLSearchParams("notice=event-draft-saved&tab=settings");
    render(
      <AdminToastProvider>
        <div>页面</div>
      </AdminToastProvider>,
    );
    expect(screen.getByRole("status").textContent).toBe("活动草稿已保存。");
    expect(navigation.router.replace).toHaveBeenCalledWith("/admin/events/event-1?tab=settings", {
      scroll: false,
    });
  });
});

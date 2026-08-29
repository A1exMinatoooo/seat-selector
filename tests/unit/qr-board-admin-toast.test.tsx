// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminToastProvider } from "@/features/admin/admin-toast";
import { QrBoard } from "@/features/entry/qr-board";

const navigation = vi.hoisted(() => ({
  router: { replace: vi.fn() },
  searchParams: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/events/event-1/checkin",
  useRouter: () => navigation.router,
  useSearchParams: () => navigation.searchParams,
}));

beforeEach(() => {
  navigation.searchParams = new URLSearchParams();
  navigation.router.replace.mockReset();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderOnsiteBoard() {
  return render(
    <AdminToastProvider>
      <QrBoard
        eventId="00000000-0000-4000-8000-000000000001"
        eventName="八月观影会"
        backHref="/admin/events/00000000-0000-4000-8000-000000000001"
        participationMode="onsite"
        maxTicketsPerIssue={7}
        ticketTypes={[{ id: "00000000-0000-4000-8000-000000000002", name: "普通票" }]}
      />
    </AdminToastProvider>,
  );
}

function issueResponse(expiresIn = 30) {
  const serverTime = new Date();
  return {
    issueId: "00000000-0000-4000-8000-000000000003",
    image: "data:image/png;base64,AA==",
    expiresIn,
    expiresAt: new Date(serverTime.getTime() + expiresIn * 1_000).toISOString(),
    serverTime: serverTime.toISOString(),
    allocation: [{ id: "00000000-0000-4000-8000-000000000002", name: "普通票", quantity: 1 }],
  };
}

function fetchForIssue({
  status = "active",
  cancelStatus = "cancelled",
  expiresIn = 30,
}: {
  status?: "active" | "claimed" | "expired" | "cancelled";
  cancelStatus?: "claimed" | "expired" | "cancelled";
  expiresIn?: number;
} = {}) {
  return vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === "POST") return Response.json(issueResponse(expiresIn));
    if (init?.method === "DELETE") return Response.json({ status: cancelStatus });
    return Response.json({ status });
  });
}

describe("onsite QR issue toast", () => {
  it("shows a success toast alongside the issued QR dialog", async () => {
    vi.stubGlobal("fetch", fetchForIssue());
    renderOnsiteBoard();
    fireEvent.click(screen.getByRole("radio", { name: "1" }));
    fireEvent.click(screen.getByRole("button", { name: "发行二维码" }));

    expect(await screen.findByRole("status")).toHaveProperty(
      "textContent",
      "现场二维码已发行，共 1 张。",
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("closes the dialog and reports the claimed ticket count", async () => {
    vi.stubGlobal("fetch", fetchForIssue({ status: "claimed" }));
    renderOnsiteBoard();
    const quantity = screen.getByRole<HTMLInputElement>("radio", { name: "1" });
    fireEvent.click(quantity);
    fireEvent.click(screen.getByRole("button", { name: "发行二维码" }));

    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe("参与者已领取，共 1 张。"),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(quantity.checked).toBe(true);
  });

  it("confirms an immediate expiry, closes the dialog, and reports a timeout", async () => {
    vi.stubGlobal("fetch", fetchForIssue({ status: "expired", expiresIn: 0 }));
    renderOnsiteBoard();
    fireEvent.click(screen.getByRole("radio", { name: "1" }));
    fireEvent.click(screen.getByRole("button", { name: "发行二维码" }));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe("二维码已超时，请重新发行。"),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps an expired QR hidden while confirmation retries after a network failure", async () => {
    let statusCalls = 0;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === "POST") return Response.json(issueResponse(0));
        statusCalls += 1;
        if (statusCalls === 1) throw new Error("offline");
        return Response.json({ status: "expired" });
      }),
    );
    renderOnsiteBoard();
    fireEvent.click(screen.getByRole("radio", { name: "1" }));
    fireEvent.click(screen.getByRole("button", { name: "发行二维码" }));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe("暂时无法确认领取结果，请检查网络。"),
    );
    expect(screen.getByRole("dialog").textContent).toContain("正在确认领取结果");
    expect(screen.queryByAltText("八月观影会 单次领取二维码")).toBeNull();

    await waitFor(
      () => expect(screen.getByRole("alert").textContent).toBe("二维码已超时，请重新发行。"),
      { timeout: 2_000 },
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(statusCalls).toBe(2);
    consoleError.mockRestore();
  });

  it("revokes the active issue and preserves the selected quantities", async () => {
    const fetchMock = fetchForIssue();
    vi.stubGlobal("fetch", fetchMock);
    renderOnsiteBoard();
    const quantity = screen.getByRole<HTMLInputElement>("radio", { name: "1" });
    fireEvent.click(quantity);
    fireEvent.click(screen.getByRole("button", { name: "发行二维码" }));
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "撤销二维码" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("status").textContent).toBe("二维码已撤销。");
    expect(quantity.checked).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("issueId=00000000-0000-4000-8000-000000000003"),
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("keeps the dialog open when revocation fails", async () => {
    const fetchMock = fetchForIssue();
    fetchMock.mockImplementation(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") return Response.json(issueResponse());
      if (init?.method === "DELETE")
        return Response.json({ error: "INTERNAL_ERROR" }, { status: 500 });
      return Response.json({ status: "active" });
    });
    vi.stubGlobal("fetch", fetchMock);
    renderOnsiteBoard();
    fireEvent.click(screen.getByRole("radio", { name: "1" }));
    fireEvent.click(screen.getByRole("button", { name: "发行二维码" }));
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "撤销二维码" }));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe("二维码撤销失败，请稍后重试。"),
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("button", { name: "撤销二维码" })).toBeTruthy();
  });

  it("shows an error toast without an inline duplicate", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ error: "VALIDATION_ERROR" }, { status: 400 })),
    );
    renderOnsiteBoard();
    fireEvent.click(screen.getByRole("radio", { name: "1" }));
    fireEvent.click(screen.getByRole("button", { name: "发行二维码" }));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe("提交的信息有误，请检查后重试。"),
    );
    expect(document.querySelector(".form-error")).toBeNull();
  });
});

// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ParticipantEntry } from "@/features/entry/participant-entry";

const navigation = vi.hoisted(() => ({ router: { refresh: vi.fn() } }));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation.router,
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("participant identity recovery", () => {
  it("clears an invalid candidate and preserves the entered phone for another attempt", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          status: "full-phone",
          candidates: [{ nickname: "小林", phone: "尾号 1234", token: "candidate-token" }],
        }),
      )
      .mockResolvedValueOnce(Response.json({ error: "IDENTITY_CANDIDATE_INVALID" }, { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<ParticipantEntry code="event-code" eventName="夏日放映" />);

    const tail = screen.getByLabelText("手机尾号") as HTMLInputElement;
    fireEvent.change(tail, { target: { value: "1234" } });
    fireEvent.click(screen.getByRole("button", { name: "继续" }));
    const remainder = await screen.findByLabelText("手机号尾号 1234 前的剩余数字");
    fireEvent.change(remainder, { target: { value: "9876543" } });
    fireEvent.click(screen.getByRole("option", { name: /小林/ }));

    const error = await screen.findByRole("alert");
    expect(error.textContent).toContain("身份选项已失效");
    expect(screen.getByText("1234", { exact: true })).toBeTruthy();
    const returnedRemainder = screen.getByLabelText(
      "手机号尾号 1234 前的剩余数字",
    ) as HTMLInputElement;
    expect(returnedRemainder.value).toBe("9876543");
    expect(returnedRemainder.getAttribute("aria-invalid")).toBe("true");
    expect(returnedRemainder.getAttribute("aria-describedby")).toBe("participant-entry-error");
    expect(screen.queryByRole("option", { name: /小林/ })).toBeNull();
    expect(screen.getByRole("button", { name: "继续" })).toBeTruthy();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it("lets a tail-only candidate choice return to the same editable tail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        Response.json({
          status: "participant-choice",
          candidates: [{ nickname: "小林", phone: "尾号 1234", token: "candidate-token" }],
        }),
      ),
    );
    render(<ParticipantEntry code="event-code" eventName="夏日放映" />);

    const tail = screen.getByLabelText("手机尾号") as HTMLInputElement;
    fireEvent.change(tail, { target: { value: "1234" } });
    fireEvent.click(screen.getByRole("button", { name: "继续" }));
    await screen.findByRole("option", { name: /小林/ });
    fireEvent.click(screen.getByRole("button", { name: "重新输入身份信息" }));

    expect(screen.getByLabelText("手机尾号")).toBeTruthy();
    expect((screen.getByLabelText("手机尾号") as HTMLInputElement).value).toBe("1234");
    expect(screen.queryByRole("option", { name: /小林/ })).toBeNull();
  });
});

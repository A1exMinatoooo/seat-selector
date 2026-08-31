import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError, errorCodes } from "@/shared/errors";

const state = vi.hoisted(() => ({
  event: {
    id: "00000000-0000-4000-8000-000000000001",
    status: "open" as "draft" | "open" | "ended",
    participationMode: "onsite" as "onsite" | "preregistered",
  },
}));
const completion = vi.hoisted(() => ({ hasCompletedReservationForDevice: vi.fn() }));
const ticketIssue = vi.hoisted(() => ({ claimTicketIssue: vi.fn() }));
const qrEntry = vi.hoisted(() => ({ consumeQrToken: vi.fn() }));
const session = vi.hoisted(() => ({
  setConsecutiveWorkflowClaim: vi.fn(),
  setEntryClaim: vi.fn(),
  setParticipantClaim: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => name === "ps_device" ? { value: "existing-device-token-123456" } : undefined,
    set: vi.fn(),
  }),
}));
vi.mock("@/server/db/client", () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => [state.event] }),
      }),
    }),
  }),
}));
vi.mock("@/server/db/participant-device", () => completion);
vi.mock("@/server/domain/ticket-issue", () => ticketIssue);
vi.mock("@/server/domain/qr-entry", () => qrEntry);
vi.mock("@/server/security/rate-limit", () => ({ rateLimit: () => true }));
vi.mock("@/server/security/crypto", () => ({
  randomToken: () => "new-device-token-1234567890",
  tokenHash: (value: string) => `hash:${value}`,
}));
vi.mock("@/server/security/participant-session", () => session);
vi.mock("@/server/env", () => ({
  env: () => ({ APP_URL: "https://example.test", TRUSTED_PROXY_COUNT: 0 }),
}));

import { POST } from "@/app/api/entry/redeem/route";

function request() {
  return new Request("https://example.test/api/entry/redeem", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      code: "summer-screening",
      token: "ticket-token-with-enough-characters",
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  state.event = {
    id: "00000000-0000-4000-8000-000000000001",
    status: "open",
    participationMode: "onsite",
  };
  completion.hasCompletedReservationForDevice.mockResolvedValue(false);
  ticketIssue.claimTicketIssue.mockResolvedValue({
    eventId: state.event.id,
    participantId: "00000000-0000-4000-8000-000000000002",
    code: "summer-screening",
  });
});

describe("participant entry redeem route", () => {
  it("prefers a preregistered completion record even after the event ends", async () => {
    state.event = { ...state.event, status: "ended", participationMode: "preregistered" };
    completion.hasCompletedReservationForDevice.mockResolvedValue(true);

    const response = await POST(request());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "SELECTION_ALREADY_COMPLETED" });
    expect(qrEntry.consumeQrToken).not.toHaveBeenCalled();
  });

  it("prefers a completed onsite record when the scanned issue is expired", async () => {
    completion.hasCompletedReservationForDevice.mockResolvedValue(true);
    ticketIssue.claimTicketIssue.mockRejectedValue(
      new DomainError(errorCodes.ticketIssueExpired, "expired", 403),
    );

    const response = await POST(request());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "SELECTION_ALREADY_COMPLETED" });
  });

  it("continues a valid linked workflow when only the source event is historical", async () => {
    completion.hasCompletedReservationForDevice.mockResolvedValue(true);
    ticketIssue.claimTicketIssue.mockResolvedValue({
      eventId: state.event.id,
      participantId: "00000000-0000-4000-8000-000000000002",
      code: "summer-screening",
      workflowId: "00000000-0000-4000-8000-000000000003",
    });

    const response = await POST(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(session.setConsecutiveWorkflowClaim).toHaveBeenCalledWith({
      workflowId: "00000000-0000-4000-8000-000000000003",
      code: "summer-screening",
    });
    expect(session.setParticipantClaim).not.toHaveBeenCalled();
  });

  it("passes through the all-linked-events completion result", async () => {
    ticketIssue.claimTicketIssue.mockRejectedValue(
      new DomainError(errorCodes.selectionAlreadyCompleted, "completed", 409),
    );

    const response = await POST(request());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "SELECTION_ALREADY_COMPLETED" });
  });
});

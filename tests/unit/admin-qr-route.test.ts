import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ hasAdminSession: vi.fn() }));
const domain = vi.hoisted(() => ({
  cancelTicketIssue: vi.fn(),
  createTicketIssue: vi.fn(),
  ticketIssueStatus: vi.fn(),
}));
const qr = vi.hoisted(() => ({ generateQrCodeDataUrl: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/server/security/admin-session", () => auth);
vi.mock("@/server/domain/ticket-issue", () => domain);
vi.mock("@/server/domain/qr-entry", () => ({ getOrCreateQrToken: vi.fn() }));
vi.mock("@/server/qr-code", () => qr);
vi.mock("@/server/env", () => ({
  env: () => ({ APP_URL: "https://example.test", TRUSTED_PROXY_COUNT: 0 }),
}));

import { DELETE, GET, POST } from "@/app/api/admin/events/[id]/qr/route";

const eventId = "00000000-0000-4000-8000-000000000001";
const issueId = "00000000-0000-4000-8000-000000000003";
const ticketTypeId = "00000000-0000-4000-8000-000000000002";
const context = { params: Promise.resolve({ id: eventId }) };

beforeEach(() => {
  vi.clearAllMocks();
  auth.hasAdminSession.mockResolvedValue(true);
});

describe("admin onsite QR route", () => {
  it("returns the authoritative terminal state from cancellation", async () => {
    domain.cancelTicketIssue.mockResolvedValue("claimed");

    const response = await DELETE(
      new Request(`https://example.test/api/admin/events/${eventId}/qr?issueId=${issueId}`, {
        method: "DELETE",
      }),
      context,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "claimed" });
    expect(domain.cancelTicketIssue).toHaveBeenCalledWith(eventId, issueId);
  });

  it("rejects an invalid cancellation id with the stable validation code", async () => {
    const response = await DELETE(
      new Request(`https://example.test/api/admin/events/${eventId}/qr?issueId=invalid`, {
        method: "DELETE",
      }),
      context,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "VALIDATION_ERROR" });
    expect(domain.cancelTicketIssue).not.toHaveBeenCalled();
  });

  it("authenticates cancellation before parsing its input", async () => {
    auth.hasAdminSession.mockResolvedValue(false);

    const response = await DELETE(
      new Request(`https://example.test/api/admin/events/${eventId}/qr?issueId=invalid`, {
        method: "DELETE",
      }),
      context,
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "UNAUTHORIZED" });
    expect(domain.cancelTicketIssue).not.toHaveBeenCalled();
  });

  it("validates status query ids", async () => {
    const response = await GET(
      new Request(`https://example.test/api/admin/events/${eventId}/qr?issueId=invalid`),
      context,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "VALIDATION_ERROR" });
    expect(domain.ticketIssueStatus).not.toHaveBeenCalled();
  });

  it("returns an explicit expiry time and current server time when issuing", async () => {
    domain.createTicketIssue.mockResolvedValue({
      issueId,
      publicCode: "event-code-1234",
      token: "ticket-token",
      expiresIn: 30,
      issuedAt: new Date("2026-08-30T10:00:00.000Z"),
      expiresAt: new Date("2026-08-30T10:00:30.000Z"),
      allocation: [{ id: ticketTypeId, name: "普通票", quantity: 1 }],
    });
    qr.generateQrCodeDataUrl.mockResolvedValue("data:image/png;base64,AA==");

    const response = await POST(
      new Request(`https://example.test/api/admin/events/${eventId}/qr`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ allocation: [{ ticketTypeId, quantity: 1 }] }),
      }),
      context,
    );
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      issueId,
      expiresAt: "2026-08-30T10:00:30.000Z",
      image: "data:image/png;base64,AA==",
    });
    expect(Date.parse(String(body.serverTime))).not.toBeNaN();
  });
});

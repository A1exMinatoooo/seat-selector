import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ getDb: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/server/db/client", () => db);
vi.mock("@/server/security/ticket-issue-token", () => ({
  createTicketIssueToken: () => ({
    issueId: "00000000-0000-4000-8000-000000000003",
    nonce: "nonce",
    token: "token",
    tokenHash: "hash",
    issuedAt: new Date("2026-08-30T10:00:00.000Z"),
    expiresAt: new Date("2026-08-30T10:00:30.000Z"),
    expiresIn: 30,
  }),
  verifyTicketIssueToken: vi.fn(),
}));

import {
  cancelTicketIssue,
  createTicketIssue,
  ticketIssueStatus,
} from "@/server/domain/ticket-issue";

const eventId = "00000000-0000-4000-8000-000000000001";
const issueId = "00000000-0000-4000-8000-000000000003";
const ticketTypeId = "00000000-0000-4000-8000-000000000002";

function lockedRow<T>(rows: T[]) {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(() => ({ for: vi.fn(async () => rows) })),
      })),
    })),
  };
}

beforeEach(() => {
  db.getDb.mockReset();
});

describe("ticket issue lifecycle", () => {
  it("reports historical invalidation as cancelled", async () => {
    db.getDb.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [
              {
                consumedAt: null,
                invalidatedAt: new Date("2026-08-30T10:00:10.000Z"),
                expiresAt: new Date("2026-08-30T10:00:30.000Z"),
              },
            ],
          }),
        }),
      }),
    });

    await expect(
      ticketIssueStatus(eventId, issueId, new Date("2026-08-30T10:00:20.000Z").getTime()),
    ).resolves.toBe("cancelled");
  });

  it("creates independent issues without invalidating other active issues", async () => {
    const insert = vi.fn(() => ({ values: vi.fn(async () => undefined) }));
    const update = vi.fn();
    const tx = {
      select: vi
        .fn()
        .mockReturnValueOnce(
          lockedRow([
            {
              id: eventId,
              publicCode: "event-code-1234",
              name: "八月观影会",
              status: "open",
              participationMode: "onsite",
              maxTicketsPerIssue: 7,
            },
          ]),
        )
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(async () => [{ id: ticketTypeId, name: "普通票" }]),
          })),
        }),
      insert,
      update,
    };
    db.getDb.mockReturnValue({ transaction: (run: (value: typeof tx) => unknown) => run(tx) });

    await createTicketIssue(eventId, [{ ticketTypeId, quantity: 1 }]);

    expect(update).not.toHaveBeenCalled();
    expect(insert).toHaveBeenCalledTimes(3);
  });

  it.each([
    ["claimed", { consumedAt: new Date("2026-08-30T10:00:10.000Z"), invalidatedAt: null }],
    ["cancelled", { consumedAt: null, invalidatedAt: new Date("2026-08-30T10:00:10.000Z") }],
    ["expired", { consumedAt: null, invalidatedAt: null }],
  ] as const)(
    "returns the existing %s terminal state when cancellation loses the race",
    async (expected, state) => {
      const update = vi.fn();
      const tx = {
        select: vi
          .fn()
          .mockReturnValueOnce(lockedRow([{ id: eventId }]))
          .mockReturnValueOnce(
            lockedRow([
              {
                ...state,
                expiresAt:
                  expected === "expired"
                    ? new Date("2026-08-30T09:59:59.000Z")
                    : new Date("2026-08-30T10:00:30.000Z"),
              },
            ]),
          ),
        update,
      };
      db.getDb.mockReturnValue({ transaction: (run: (value: typeof tx) => unknown) => run(tx) });

      await expect(
        cancelTicketIssue(eventId, issueId, new Date("2026-08-30T10:00:20.000Z").getTime()),
      ).resolves.toBe(expected);
      expect(update).not.toHaveBeenCalled();
    },
  );

  it("invalidates only the requested active issue", async () => {
    const returning = vi.fn(async () => [{ id: issueId }]);
    const where = vi.fn(() => ({ returning }));
    const set = vi.fn(() => ({ where }));
    const update = vi.fn(() => ({ set }));
    const tx = {
      select: vi
        .fn()
        .mockReturnValueOnce(lockedRow([{ id: eventId }]))
        .mockReturnValueOnce(
          lockedRow([
            {
              consumedAt: null,
              invalidatedAt: null,
              expiresAt: new Date("2026-08-30T10:00:30.000Z"),
            },
          ]),
        ),
      update,
    };
    db.getDb.mockReturnValue({ transaction: (run: (value: typeof tx) => unknown) => run(tx) });

    await expect(
      cancelTicketIssue(eventId, issueId, new Date("2026-08-30T10:00:20.000Z").getTime()),
    ).resolves.toBe("cancelled");
    expect(update).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith({
      invalidatedAt: new Date("2026-08-30T10:00:20.000Z"),
    });
  });
});

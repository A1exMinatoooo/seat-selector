import { describe, expect, it } from "vitest";
import {
  groupedTicketIssueAllocationSchema,
  hasOnsiteLotteryCapacity,
  ticketIssueAllocationSchema,
  ticketIssueTotal,
} from "@/server/domain/ticket-issue-rules";

const ordinary = "00000000-0000-4000-8000-000000000001";
const premium = "00000000-0000-4000-8000-000000000002";

describe("onsite ticket issue rules", () => {
  it("accepts a mixed ticket allocation and totals it", () => {
    const allocation = ticketIssueAllocationSchema.parse([
      { ticketTypeId: ordinary, quantity: 2 },
      { ticketTypeId: premium, quantity: 1 },
    ]);
    expect(ticketIssueTotal(allocation)).toBe(3);
  });

  it("rejects duplicate ticket types and invalid quantities", () => {
    expect(
      ticketIssueAllocationSchema.safeParse([
        { ticketTypeId: ordinary, quantity: 1 },
        { ticketTypeId: ordinary, quantity: 1 },
      ]).success,
    ).toBe(false);
    expect(
      ticketIssueAllocationSchema.safeParse([{ ticketTypeId: ordinary, quantity: 21 }]).success,
    ).toBe(false);
  });

  it("checks expected lottery capacity after replacing an unseated claim", () => {
    expect(hasOnsiteLotteryCapacity(7, 3, 10)).toBe(true);
    expect(hasOnsiteLotteryCapacity(8, 3, 10)).toBe(false);
  });

  it("allows a linked event to have zero tickets while keeping the source allocation", () => {
    expect(
      groupedTicketIssueAllocationSchema.safeParse([
        { eventId: ordinary, allocation: [{ ticketTypeId: premium, quantity: 1 }] },
        { eventId: premium, allocation: [] },
      ]).success,
    ).toBe(true);
  });

  it("rejects duplicate event groups", () => {
    expect(
      groupedTicketIssueAllocationSchema.safeParse([
        { eventId: ordinary, allocation: [{ ticketTypeId: premium, quantity: 1 }] },
        { eventId: ordinary, allocation: [] },
      ]).success,
    ).toBe(false);
  });
});

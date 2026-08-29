// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TicketTypeFields } from "@/features/events/ticket-type-fields";

afterEach(cleanup);

function submittedTicketTypes() {
  const input = document.querySelector<HTMLInputElement>('input[name="ticketTypes"]');
  return JSON.parse(input?.value ?? "[]") as Array<{ name: string; lotteryEligible: boolean }>;
}

describe("TicketTypeFields defaults", () => {
  it("uses seven as the new onsite issue default", () => {
    render(<TicketTypeFields />);
    expect(
      document.querySelector<HTMLInputElement>('input[name="maxTicketsPerIssue"]')?.value,
    ).toBe("7");
  });

  it("selects all current and newly added ticket types when lottery is enabled", () => {
    render(<TicketTypeFields />);
    fireEvent.click(screen.getByRole("checkbox", { name: "开启活动抽奖" }));
    expect(screen.getAllByRole("checkbox", { name: "参与抽奖" })).toHaveLength(1);
    expect((screen.getByRole("checkbox", { name: "参与抽奖" }) as HTMLInputElement).checked).toBe(
      true,
    );

    fireEvent.click(screen.getByRole("button", { name: "添加票种" }));
    const eligible = screen.getAllByRole("checkbox", { name: "参与抽奖" });
    expect(eligible).toHaveLength(2);
    expect((eligible[1] as HTMLInputElement).checked).toBe(true);

    fireEvent.click(eligible[1]!);
    expect(submittedTicketTypes().map((type) => type.lotteryEligible)).toEqual([true, false]);
  });

  it("preserves an edited mixed selection until lottery is toggled off and on", () => {
    render(
      <TicketTypeFields
        initialLotteryEnabled
        initialTypes={[
          { id: "type-1", name: "普通票", lotteryEligible: true },
          { id: "type-2", name: "赠票", lotteryEligible: false },
        ]}
        initialPrizes={[{ name: "海报", quantity: 1 }]}
      />,
    );
    expect(
      screen
        .getAllByRole("checkbox", { name: "参与抽奖" })
        .map((input) => (input as HTMLInputElement).checked),
    ).toEqual([true, false]);

    fireEvent.click(screen.getByRole("checkbox", { name: "开启活动抽奖" }));
    expect(submittedTicketTypes().every((type) => !type.lotteryEligible)).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: "开启活动抽奖" }));
    expect(
      screen
        .getAllByRole("checkbox", { name: "参与抽奖" })
        .every((input) => (input as HTMLInputElement).checked),
    ).toBe(true);
  });
});

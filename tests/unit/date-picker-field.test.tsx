// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DatePickerField } from "@/features/forms/date-picker-field";

describe("DatePickerField", () => {
  it("submits the existing date and opens an accessible calendar", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <form>
        <DatePickerField name="startDate" label="开始日期" defaultValue="2026-08-18" required />
      </form>,
    );

    expect(new FormData(container.querySelector("form")!).get("startDate")).toBe("2026-08-18");
    const calendarButton = screen.getByRole("button", { name: /打开日历/ });
    expect(calendarButton.querySelector(".lucide-calendar-days")).toBeTruthy();
    await user.click(calendarButton);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /上个月/ }).querySelector(".lucide-chevron-left"),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /下个月/ }).querySelector(".lucide-chevron-right"),
    ).toBeTruthy();
    expect(screen.getAllByRole("gridcell").length).toBeGreaterThan(27);
    const cells = screen.getAllByRole("gridcell");
    const nextDay = cells.find(
      (cell) => cell.textContent === "19" && !cell.hasAttribute("data-outside-month"),
    );
    expect(nextDay).toBeTruthy();
    await user.click(nextDay!.firstElementChild ?? nextDay!);
    expect(new FormData(container.querySelector("form")!).get("startDate")).toBe("2026-08-19");
  });

  it("keeps a new required date empty until the user enters it", () => {
    const { container } = render(
      <form>
        <DatePickerField name="startDate" label="开始日期" required />
      </form>,
    );

    expect(new FormData(container.querySelector("form")!).get("startDate")).toBe("");
  });
});

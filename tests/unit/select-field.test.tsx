// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SearchableSelectField, SelectField } from "@/features/forms/select-field";

describe("SelectField", () => {
  afterEach(cleanup);
  it("submits selected option ids and supports grouped display values", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { container } = render(
      <form>
        <SelectField
          name="hallId"
          label="影厅"
          value="hall-a"
          onValueChange={onValueChange}
          groups={[
            { id: "cinema-a", label: "甲影院", options: [{ id: "hall-a", label: "1号厅" }] },
            { id: "cinema-b", label: "乙影院", options: [{ id: "hall-b", label: "IMAX厅" }] },
          ]}
          displayValue={(id) => (id === "hall-a" ? "甲影院 · 1号厅" : "乙影院 · IMAX厅")}
        />
      </form>,
    );

    await user.click(screen.getByRole("button", { name: /甲影院 · 1号厅/ }));
    expect(screen.getByText("甲影院").getAttribute("role")).not.toBe("option");
    await user.click(screen.getByRole("option", { name: "IMAX厅" }));

    expect(onValueChange).toHaveBeenCalledWith("hall-b");
    expect(new FormData(container.querySelector("form")!).get("hallId")).toBe("hall-a");
  });

  it("filters a searchable select and submits the selected key", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <form>
        <SearchableSelectField
          name="timeZone"
          label="显示时区"
          defaultValue="Asia/Shanghai"
          options={[
            { id: "Asia/Shanghai", label: "Asia/Shanghai" },
            { id: "Asia/Tokyo", label: "Asia/Tokyo" },
          ]}
        />
      </form>,
    );

    const input = screen.getByRole("combobox", { name: "显示时区" });
    await user.clear(input);
    await user.type(input, "Tokyo");
    await user.click(screen.getByRole("option", { name: "Asia/Tokyo" }));

    expect((input as HTMLInputElement).value).toBe("Asia/Tokyo");
    expect(input.getAttribute("aria-expanded")).toBe("false");
    expect(new FormData(container.querySelector("form")!).get("timeZone")).toBe("Asia/Tokyo");
  });

  it("opens the complete searchable option list when the field receives focus", async () => {
    const user = userEvent.setup();
    render(
      <SearchableSelectField
        label="显示时区"
        defaultValue="Asia/Shanghai"
        options={[
          { id: "Asia/Shanghai", label: "Asia/Shanghai" },
          { id: "Asia/Tokyo", label: "Asia/Tokyo" },
        ]}
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "显示时区" }));
    expect(screen.getByRole("option", { name: "Asia/Shanghai" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Asia/Tokyo" })).toBeTruthy();
  });
});

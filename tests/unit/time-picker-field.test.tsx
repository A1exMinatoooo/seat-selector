// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { parseTimeSelection, TimePickerField } from "@/features/forms/time-picker-field";

afterEach(cleanup);

describe("TimePickerField", () => {
  it("accepts only valid whole-minute time strings", () => {
    expect(parseTimeSelection("23:59")).toEqual({ hour: "23", minute: "59" });
    expect(parseTimeSelection("24:00")).toEqual({ hour: "", minute: "" });
    expect(parseTimeSelection("12:60")).toEqual({ hour: "", minute: "" });
    expect(parseTimeSelection("9:05")).toEqual({ hour: "", minute: "" });
  });

  it("selects hour and minute in separate lists and submits HH:mm", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <form>
        <TimePickerField name="startTime" label="开始时间" required />
      </form>,
    );

    const trigger = screen.getByRole("button", { name: /开始时间/ });
    await user.click(trigger);
    await user.click(
      within(screen.getByRole("listbox", { name: "小时" })).getByRole("option", { name: "13" }),
    );
    await user.click(
      within(screen.getByRole("listbox", { name: "分钟" })).getByRole("option", { name: "05" }),
    );
    await user.click(screen.getByRole("button", { name: "完成" }));

    expect(new FormData(container.querySelector("form")!).get("startTime")).toBe("13:05");
    expect(screen.getByRole("button", { name: /开始时间/ }).textContent).toContain("13:05");
  });

  it("offers five-minute steps without rewriting an existing off-step value on cancel", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <form>
        <TimePickerField name="startTime" label="开始时间" defaultValue="13:07" />
      </form>,
    );
    await user.click(screen.getByRole("button", { name: /开始时间/ }));
    const minutes = within(screen.getByRole("listbox", { name: "分钟" }));
    expect(minutes.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55",
    ]);
    await user.click(minutes.getByRole("option", { name: "10" }));
    await user.keyboard("{Escape}");
    expect(new FormData(container.querySelector("form")!).get("startTime")).toBe("13:07");
    await user.click(screen.getByRole("button", { name: /开始时间/ }));
    await user.click(within(screen.getByRole("listbox", { name: "分钟" })).getByRole("option", { name: "10" }));
    await user.click(screen.getByRole("button", { name: "完成" }));
    expect(new FormData(container.querySelector("form")!).get("startTime")).toBe("13:10");
  });

  it("keeps the required field invalid while empty", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <form>
        <TimePickerField name="startTime" label="开始时间" required />
        <button type="submit">保存</button>
      </form>,
    );

    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(
      within(container).getByRole("group", { name: "开始时间" }).getAttribute("data-invalid"),
    ).toBe("true");
    expect(screen.getByRole("alert").textContent).toBe("请选择时间");
  });
});

// @vitest-environment jsdom

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { parseTimeSelection, TimePickerField } from "@/features/forms/time-picker-field";

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
    expect(trigger.querySelector(".lucide-chevron-down")?.getAttribute("aria-hidden")).toBe("true");
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

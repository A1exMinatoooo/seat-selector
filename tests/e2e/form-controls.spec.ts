import { expect, test } from "@playwright/test";

const fixture = "http://127.0.0.1:3101/?kind=forms";

test("searchable selection supports keyboard recovery and disabled controls", async ({ page }) => {
  await page.goto(fixture);
  const zone = page.getByRole("combobox", { name: "显示时区", exact: true });
  await zone.fill("Tokyo");
  await zone.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(zone).toHaveValue("Asia/Tokyo");
  await expect(page.locator('input[name="zone"]')).toHaveValue("Tokyo");
  await zone.fill("no-such-timezone");
  await expect(page.getByText("没有匹配项", { exact: true })).toBeVisible();
  await zone.press("Escape");
  await expect(zone).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("combobox", { name: "不可编辑时区", exact: true })).toBeDisabled();
  await expect(
    page
      .locator(".searchable-select-field")
      .filter({ has: page.getByText("不可编辑时区", { exact: true }) })
      .getByRole("button", { name: "展开选项" }),
  ).toBeDisabled();
});

test("time confirmation commits while cancellation preserves the submitted value", async ({
  page,
}) => {
  await page.goto(fixture);
  const time = page.locator('input[name="time"]');
  await page.getByRole("button", { name: "开始时间，未选择" }).click();
  await expect(page.getByRole("button", { name: "完成", exact: true })).toBeDisabled();
  await page
    .getByRole("listbox", { name: "小时", exact: true })
    .getByRole("option", { name: "18", exact: true })
    .click();
  await page
    .getByRole("listbox", { name: "分钟", exact: true })
    .getByRole("option", { name: "30", exact: true })
    .click();
  await page.getByRole("button", { name: "完成", exact: true }).click();
  await expect(time).toHaveValue("18:30");
  await page.getByRole("button", { name: "开始时间，18:30" }).click();
  await page
    .getByRole("listbox", { name: "小时", exact: true })
    .getByRole("option", { name: "19", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(time).toHaveValue("18:30");
  await page.getByRole("button", { name: "提交验收表单" }).click();
  await expect(page.getByLabel("提交结果")).toContainText('"time":"18:30"');
  await expect(page.getByLabel("提交结果")).toContainText('"date":"2026-10-03"');
});

test("required time focuses its visible control and the calendar fits a narrow phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto(fixture);
  await page.getByRole("button", { name: "提交验收表单" }).click();
  const trigger = page.getByRole("button", { name: "开始时间，未选择" });
  await expect(trigger).toBeFocused();
  await expect(page.getByRole("alert")).toHaveText("请选择时间");
  await page.getByRole("button", { name: /打开日历/ }).click();
  const calendar = page.locator(".date-picker-popover");
  const box = await calendar.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(320);
  await page.getByRole("button", { name: "下个月", exact: true }).click();
  await expect(page.locator(".date-picker-calendar header h2")).toContainText("11");
});

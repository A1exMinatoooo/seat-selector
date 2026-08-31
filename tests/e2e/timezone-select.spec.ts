import { expect, test } from "@playwright/test";

const adminPassword = process.env.E2E_ADMIN_PASSWORD;

test("searching a timezone keeps the selected form value", async ({ page }) => {
  test.skip(!adminPassword, "E2E_ADMIN_PASSWORD is required for authenticated form tests");

  await page.goto("/admin/events/new");
  if (page.url().includes("/admin/login")) {
    await page.getByLabel("管理员口令").fill(adminPassword!);
    await page.getByRole("button", { name: "登录管理端" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    const sessionCookie = (await page.context().cookies()).find(
      (cookie) => cookie.name === "pickseat_admin",
    );
    if (sessionCookie && new URL(page.url()).protocol === "http:") {
      await page.context().addCookies([{ ...sessionCookie, secure: false }]);
    }
    await page.goto("/admin/events/new");
  }

  const timeZone = page.getByRole("combobox", { name: "显示时区" });
  const timeZoneButton = page.getByRole("button", { name: "展开选项" });
  const calendarButton = page.getByRole("button", { name: "打开日历" });
  for (const button of [timeZoneButton, calendarButton]) {
    const alignment = await button.evaluate((element) => {
      const buttonRect = element.getBoundingClientRect();
      const iconRect = element.querySelector("svg")?.getBoundingClientRect();
      if (!iconRect) return null;
      return {
        width: buttonRect.width,
        height: buttonRect.height,
        horizontalOffset: Math.abs(
          buttonRect.left + buttonRect.width / 2 - (iconRect.left + iconRect.width / 2),
        ),
        verticalOffset: Math.abs(
          buttonRect.top + buttonRect.height / 2 - (iconRect.top + iconRect.height / 2),
        ),
      };
    });
    expect(alignment).not.toBeNull();
    expect(alignment!.width).toBeGreaterThanOrEqual(44);
    expect(alignment!.height).toBeGreaterThanOrEqual(44);
    expect(alignment!.horizontalOffset).toBeLessThanOrEqual(1);
    expect(alignment!.verticalOffset).toBeLessThanOrEqual(1);
  }

  await timeZone.fill("Tokyo");
  await page.getByRole("option", { name: "Asia/Tokyo", exact: true }).click();

  await expect(timeZone).toHaveValue("Asia/Tokyo");
  await expect(timeZone).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator('input[type="hidden"][name="timeZone"]')).toHaveValue("Asia/Tokyo");

  await page.getByLabel("活动名称").focus();
  await expect(timeZone).toHaveValue("Asia/Tokyo");
  await expect(page.locator('input[type="hidden"][name="timeZone"]')).toHaveValue("Asia/Tokyo");
});

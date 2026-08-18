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
  await timeZone.fill("Tokyo");
  await page.getByRole("option", { name: "Asia/Tokyo", exact: true }).click();

  await expect(timeZone).toHaveValue("Asia/Tokyo");
  await expect(timeZone).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator('input[type="hidden"][name="timeZone"]')).toHaveValue("Asia/Tokyo");

  await page.getByLabel("活动名称").focus();
  await expect(timeZone).toHaveValue("Asia/Tokyo");
  await expect(page.locator('input[type="hidden"][name="timeZone"]')).toHaveValue("Asia/Tokyo");
});

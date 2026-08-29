import { expect, test } from "@playwright/test";

const adminPassword = process.env.E2E_ADMIN_PASSWORD;

async function loginIfNeeded(page: import("@playwright/test").Page) {
  if (!page.url().includes("/admin/login")) return;
  await page.getByLabel("管理员口令").fill(adminPassword!);
  await page.getByRole("button", { name: "登录管理端" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  const sessionCookie = (await page.context().cookies()).find(
    (cookie) => cookie.name === "pickseat_admin",
  );
  if (sessionCookie && new URL(page.url()).protocol === "http:") {
    await page.context().addCookies([{ ...sessionCookie, secure: false }]);
  }
}

test("admin mutations show same-page, failure, and cross-page toasts", async ({
  page,
}, testInfo) => {
  test.skip(!adminPassword, "E2E_ADMIN_PASSWORD is required for authenticated mutation tests");
  const name = `Toast E2E ${testInfo.project.name} ${Date.now()}`;
  const updatedName = `${name} Updated`;

  await page.goto("/admin/locations");
  await loginIfNeeded(page);
  await page.goto("/admin/locations");

  const fillLocation = async (locationName: string) => {
    await page.getByLabel("地点名称").fill(locationName);
    await page.getByLabel("纬度").fill("35.6812");
    await page.getByLabel("经度").fill("139.7671");
    await page.getByLabel("默认范围（米）").fill("1000");
  };

  await fillLocation(name);
  await page.getByRole("button", { name: "保存地点" }).click();
  await expect(page.getByRole("status")).toHaveText("地点已保存。");

  await fillLocation(name);
  await page.getByRole("button", { name: "保存地点" }).click();
  await expect(page.getByRole("alert")).toHaveText("地点名称已存在，请使用其他名称。");

  await page.getByRole("link", { name: `编辑地点 ${name}` }).click();
  await page.getByLabel("地点名称").fill(updatedName);
  await page.getByRole("button", { name: "保存地点变更" }).click();
  await expect(page).toHaveURL(/\/admin\/locations$/);
  await expect(page.getByRole("status")).toHaveText("地点变更已保存。");

  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("listitem")
    .filter({ hasText: updatedName })
    .getByRole("button", { name: "删除" })
    .click();
  await expect(page.getByRole("status")).toHaveText("地点已删除。");
});

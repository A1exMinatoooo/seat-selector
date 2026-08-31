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
  await expect(page.locator('.admin-save-toast[role="alert"]')).toHaveText(
    "地点名称已存在，请使用其他名称。",
  );

  await page.getByRole("link", { name: `编辑地点 ${name}` }).click();
  await expect(page).toHaveURL(/\/admin\/locations\/.+\/edit$/);
  await page.waitForLoadState("networkidle");
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

test("imports Apple Maps coordinates when creating and editing a location", async ({
  page,
}, testInfo) => {
  test.skip(!adminPassword, "E2E_ADMIN_PASSWORD is required for authenticated mutation tests");
  const suffix = `${testInfo.project.name} ${Date.now()}`;
  const createdName = `Apple Maps 深圳 ${suffix}`;
  const updatedName = `Apple Maps 东京 ${suffix}`;
  const shenzhenUrl =
    "https://maps.apple.com/place?address=Baishi%203rd%20Road%20and%20Shenwan%202nd%20Road%20Interchange%20Chushenwan%20Ruiyun%20Center%20Shenzhenwan%20Ruiyin%20RAIL%20F%20INL4,%20Nanshan,%20Shenzhen,%20Guangdong%20China&coordinate=22.523833,113.969738&name=Hoyts%20Cinema%20(Shenzhenwan%20Rail%20In%20Branch)";
  const tokyoUrl =
    "https://maps.apple.com/place?address=Tokyo%20Japan&ll=35.6812,139.7671&q=Tokyo%20Station";

  await page.goto("/admin/locations");
  await loginIfNeeded(page);
  await page.goto("/admin/locations");

  await page.getByLabel("Apple 地图分享链接").fill(shenzhenUrl);
  await page.getByRole("button", { name: "导入 Apple 地图" }).click();
  await expect(page.getByLabel("地点名称")).toHaveValue(
    "Hoyts Cinema (Shenzhenwan Rail In Branch)",
  );
  await expect(page.getByLabel("纬度")).toHaveValue("22.5268020");
  await expect(page.getByLabel("经度")).toHaveValue("113.9648271");
  await expect(page.getByText("坐标已从 GCJ-02 转换为 WGS-84。")).toBeVisible();

  await page.getByLabel("地点名称").fill(createdName);
  await page.getByRole("button", { name: "保存地点" }).click();
  await expect(page.getByRole("status")).toHaveText("地点已保存。");
  const createdLocation = page.getByRole("listitem").filter({ hasText: createdName });
  await expect(createdLocation).toContainText("22.52680, 113.96483");

  await createdLocation.getByRole("link", { name: `编辑地点 ${createdName}` }).click();
  await expect(page).toHaveURL(/\/admin\/locations\/.+\/edit$/);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Apple 地图分享链接").fill(tokyoUrl);
  await page.getByRole("button", { name: "导入 Apple 地图" }).click();
  await expect(page.getByLabel("地点名称")).toHaveValue("Tokyo Station");
  await expect(page.getByLabel("纬度")).toHaveValue("35.6812000");
  await expect(page.getByLabel("经度")).toHaveValue("139.7671000");
  await expect(page.getByText("坐标位于转换范围外，已按 WGS-84 原样导入。")).toBeVisible();

  await page.getByLabel("地点名称").fill(updatedName);
  await page.getByRole("button", { name: "保存地点变更" }).click();
  await expect(page).toHaveURL(/\/admin\/locations$/);
  await expect(page.getByRole("status")).toHaveText("地点变更已保存。");
  const updatedLocation = page.getByRole("listitem").filter({ hasText: updatedName });
  await expect(updatedLocation).toContainText("35.68120, 139.76710");
  page.once("dialog", (dialog) => dialog.accept());
  await updatedLocation.getByRole("button", { name: "删除" }).click();
  await expect(page.getByRole("status")).toHaveText("地点已删除。");
});

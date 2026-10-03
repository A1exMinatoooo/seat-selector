import { expect, test } from "@playwright/test";
import { loadLocalTestConfig } from "../../scripts/local-test/config";
import { withLocalTestDb } from "../../src/server/db/local-test-database";
import { readLocalTestFixtureManifest } from "../../src/server/db/local-test-seed";

const localMode = process.env.LOCAL_TEST_E2E === "1";

test("real event validation retains dynamic rows, never moves errors to a replacement row, and saves after correction", async ({ page }, testInfo) => {
  test.skip(!localMode || testInfo.project.name !== "desktop", "Requires isolated local:e2e database");
  const name = `Refine 动态票种 ${Date.now()}`;
  await page.goto("/admin/events/new");
  await page.getByLabel("活动名称").fill(name);
  await page.getByText("预录参与者", { exact: true }).click();
  await expect(page.getByRole("radio", { name: "预录参与者", exact: true })).toBeChecked();
  await page.getByLabel("票种 1", { exact: true }).fill("普通票");
  await page.getByRole("button", { name: "添加票种", exact: true }).click();
  await page.getByLabel("票种 2", { exact: true }).fill("普通票");
  await page.getByRole("button", { name: "保存草稿", exact: true }).click();
  await expect(page.locator(".admin-action-result")).toBeVisible();
  await expect(page.getByLabel("活动名称")).toHaveValue(name);
  await expect(page.getByLabel("票种 1", { exact: true })).toHaveValue("普通票");
  await expect(page.getByLabel("票种 2", { exact: true })).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("票种 2", { exact: true })).toBeFocused();
  const secondRow = page.locator(".ticket-type-row").nth(1);
  await secondRow.getByRole("button", { name: "移除", exact: true }).click();
  await page.getByRole("button", { name: "添加票种", exact: true }).click();
  const replacement = page.getByLabel("票种 2", { exact: true });
  await replacement.fill("修正学生票");
  await expect(replacement).not.toHaveAttribute("aria-invalid", "true");
  await page.getByRole("button", { name: "保存草稿", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/events\/[^/]+$/);
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await expect(page.locator(".ticket-type-row").nth(1).locator("input[type=text], input:not([type])").first()).toHaveValue("修正学生票");
  await page.getByLabel("活动名称").fill(`${name} 已编辑`);
  await page.getByRole("button", { name: "保存活动设置", exact: true }).click();
  await expect(page.getByRole("heading", { name: `${name} 已编辑`, exact: true })).toBeVisible();
  const eventId = new URL(page.url()).pathname.split("/").at(-1)!;
  await page.goto(`/admin/events/${eventId}/participants`);
  const csv = page.locator('input[name="csv"]');
  const header = await (await page.request.get(`/api/admin/events/${eventId}/participants/template.csv`)).text();
  await csv.setInputFiles({ name: "invalid.csv", mimeType: "text/csv", buffer: Buffer.from(`${header}Refine导入,3234,21,0\r\n`) });
  await page.getByRole("button", { name: "导入参与者", exact: true }).click();
  await expect(csv).toHaveAttribute("aria-invalid", "true");
  expect(await csv.evaluate((input: HTMLInputElement) => input.files?.[0]?.name)).toBe("invalid.csv");
  await csv.setInputFiles({ name: "corrected.csv", mimeType: "text/csv", buffer: Buffer.from(`${header}Refine导入,3234,1,0\r\n`) });
  await page.getByRole("button", { name: "导入参与者", exact: true }).click();
  await expect(page.getByRole("row").filter({ hasText: "Refine导入" })).toContainText("普通票 × 1");
  await expect.poll(() => csv.evaluate((input: HTMLInputElement) => input.files?.length)).toBe(0);
  const manual = page.locator("form").filter({ has: page.locator('input[name="nickname"]') });
  await manual.locator('input[name="nickname"]').fill("Refine手工");
  await manual.locator('input[name="phone"]').fill("4224");
  await manual.getByRole("button", { name: "增加参与者", exact: true }).click();
  await expect(manual.locator(".admin-action-result")).toBeVisible();
  await expect(manual.locator('input[name="nickname"]')).toHaveValue("Refine手工");
  await manual.locator('input[name^="ticket:"]').first().fill("1");
  await manual.getByRole("button", { name: "增加参与者", exact: true }).click();
  await expect(page.getByRole("row").filter({ hasText: "Refine手工" })).toContainText("普通票 × 1");
  await expect(manual.locator('input[name="nickname"]')).toHaveValue("");
  await expect(manual.locator('input[name^="ticket:"]').first()).toHaveValue("0");
});

test("clear selection cancels without a request and confirmed operation releases the recorded seats", async ({ page }, testInfo) => {
  test.skip(!localMode || testInfo.project.name !== "desktop", "Requires isolated local:e2e database");
  const config = loadLocalTestConfig();
  const manifest = await withLocalTestDb({ port: config.dbPort, password: config.databasePassword, target: "e2e" }, readLocalTestFixtureManifest);
  await page.goto(`/admin/events/${manifest.eventIds["local-preregistered"]}/participants`);
  const row = page.getByRole("row").filter({ hasText: "测试已选一" });
  await expect(row).not.toContainText("未选");
  let mutationRequests = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.headers()["next-action"]) mutationRequests++;
  });
  page.once("dialog", (dialog) => dialog.dismiss());
  await row.getByRole("button", { name: "清除选座", exact: true }).click();
  await expect(row.getByRole("button", { name: "清除选座", exact: true })).toBeEnabled();
  expect(mutationRequests).toBe(0);
  page.once("dialog", (dialog) => dialog.accept());
  await row.getByRole("button", { name: "清除选座", exact: true }).click();
  await expect(row).toContainText("未选");
  await expect(row.getByRole("button", { name: "清除选座", exact: true })).toHaveCount(0);
  expect(mutationRequests).toBe(1);
});

test("narrow real editors expose every zoom action inside the toolbar", async ({ page }, testInfo) => {
  test.skip(!localMode || testInfo.project.name !== "desktop", "Requires isolated local:e2e database");
  const config = loadLocalTestConfig();
  const manifest = await withLocalTestDb({ port: config.dbPort, password: config.databasePassword, target: "e2e" }, readLocalTestFixtureManifest);
  for (const route of ["/admin/events/new", `/admin/events/${manifest.eventIds["local-draft-status"]}`, "/admin/venues"]) {
    await page.goto(route);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      const toolbar = page.locator(".seat-grid-viewport-toolbar").first();
      await toolbar.scrollIntoViewIfNeeded();
      const bounds = await toolbar.boundingBox();
      if (!bounds) throw new Error(`Missing zoom toolbar: ${route}`);
      for (const name of ["缩小座位网格", "放大座位网格", "缩放以显示完整座位网格"]) {
        const button = toolbar.getByRole("button", { name, exact: true });
        await expect(button).toBeVisible();
        const box = await button.boundingBox();
        if (!box) throw new Error(`Missing zoom action: ${name}`);
        expect(box.x).toBeGreaterThanOrEqual(bounds.x);
        expect(box.x + box.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1);
        await button.click();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
  }
});

test("real template creation resets the layout; invalid JSON is retained and corrected import, versioning, and archive preserve semantics", async ({ page }, testInfo) => {
  test.skip(!localMode || testInfo.project.name !== "desktop", "Requires isolated local:e2e database");
  const suffix = Date.now();
  const cinemaName = `Refine影院${suffix}`;
  const hallName = `Refine影厅${suffix}`;
  await page.goto("/admin/venues");
  await page.getByLabel("影院名称").fill(cinemaName);
  await page.getByRole("button", { name: "保存影院", exact: true }).click();
  await expect(page.getByLabel("影院名称")).toHaveValue("");
  await page.getByRole("button", { name: "所属影院" }).click();
  await page.getByRole("option", { name: cinemaName, exact: true }).click();
  const create = page.locator("form").filter({ has: page.getByRole("button", { name: "保存影厅模板", exact: true }) });
  const initialRows = await create.getByRole("spinbutton", { name: "行数", exact: true }).inputValue();
  await create.locator('input[name="name"]').fill(hallName);
  await create.getByRole("spinbutton", { name: "行数", exact: true }).fill("2");
  await create.getByRole("spinbutton", { name: "列数", exact: true }).fill("3");
  await create.getByRole("button", { name: "自动生成", exact: true }).click();
  await create.getByRole("button", { name: "保存影厅模板", exact: true }).click();
  await expect(create.locator('input[name="name"]')).toHaveValue("");
  await expect(create.getByRole("spinbutton", { name: "行数", exact: true })).toHaveValue(initialRows);
  const group = page.locator(".hall-template-groups details").filter({ has: page.locator("summary").filter({ hasText: cinemaName }) });
  await group.locator("summary").click();
  const hall = group.getByRole("listitem").filter({ hasText: hallName });
  await expect(hall).toContainText("6 个网格单元");
  const exported = await page.request.get((await hall.getByRole("link", { name: "导出", exact: true }).getAttribute("href"))!);
  expect(exported.ok()).toBe(true);
  const json = await exported.body();
  const file = page.locator('input[name="template"]');
  await file.setInputFiles({ name: "invalid.json", mimeType: "application/json", buffer: Buffer.from("{") });
  await page.getByRole("button", { name: "导入模板", exact: true }).click();
  await expect(file).toHaveAttribute("aria-invalid", "true");
  expect(await file.evaluate((input: HTMLInputElement) => input.files?.[0]?.name)).toBe("invalid.json");
  await file.setInputFiles({ name: "exported.json", mimeType: "application/json", buffer: json });
  await page.getByRole("button", { name: "导入模板", exact: true }).click();
  await expect(hall).toHaveCount(2);
  await expect.poll(() => file.evaluate((input: HTMLInputElement) => input.files?.length)).toBe(0);
  await hall.first().getByRole("link", { name: "编辑", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/venues\/[^/]+\/edit$/);
  await page.getByLabel("影厅名称").fill(`${hallName}新版`);
  await page.getByRole("button", { name: "保存新版模板", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/venues(?:\?|$)/);
  await group.locator("summary").click();
  const newHall = group.getByRole("listitem").filter({ hasText: `${hallName}新版` });
  await expect(newHall).toContainText("6 个网格单元");
  page.once("dialog", (dialog) => dialog.accept());
  await newHall.getByRole("button", { name: "归档", exact: true }).click();
  await expect(newHall).toHaveCount(0);
  await expect(group.getByRole("listitem").filter({ hasText: hallName })).toHaveCount(1);
});

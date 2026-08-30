import { expect, test } from "@playwright/test";

test("landing page presents the organizer entry", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /让每一次集体观影/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "进入活动管理" })).toHaveAttribute("href", "/admin");
  await expect(page.getByRole("heading", { name: "一张票，一次可靠的现场体验" })).toBeVisible();
  await expect(page.getByLabel("产品能力").getByRole("article")).toHaveCount(3);
  await expect(page.getByText("动态二维码轮换", { exact: true })).toBeVisible();
  await expect(page.getByText("峰值并发支持", { exact: true })).toBeVisible();
  await expect(page.getByText("座位状态同步", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "为下一场放映做好准备" })).toHaveAttribute(
    "href",
    "/admin",
  );
});

test("landing page uses a split layout on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  const introduction = await page.getByTestId("home-introduction").boundingBox();
  const showcase = await page.getByTestId("home-showcase").boundingBox();

  expect(introduction).not.toBeNull();
  expect(showcase).not.toBeNull();
  expect(showcase!.x).toBeGreaterThanOrEqual(introduction!.x + introduction!.width - 1);
});

test("landing page remains usable on a phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.getByRole("link", { name: "进入活动管理" })).toBeInViewport();

  const introduction = await page.getByTestId("home-introduction").boundingBox();
  const showcase = await page.getByTestId("home-showcase").boundingBox();
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );

  expect(introduction).not.toBeNull();
  expect(showcase).not.toBeNull();
  expect(showcase!.y).toBeGreaterThanOrEqual(introduction!.y + introduction!.height - 1);
  expect(hasHorizontalOverflow).toBe(false);
});

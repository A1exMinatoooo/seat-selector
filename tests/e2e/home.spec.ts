import { expect, test } from "@playwright/test";

test("landing page presents the organizer entry", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /让每一次集体观影/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "进入活动管理" })).toHaveAttribute("href", "/admin");
});

test("landing page remains usable on a phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("link", { name: "进入活动管理" })).toBeInViewport();
});

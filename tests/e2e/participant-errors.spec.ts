import { expect, test } from "@playwright/test";

async function openCompletedScan(page: import("@playwright/test").Page) {
  await page.route("**/api/entry/redeem", async (route) => {
    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({ error: "SELECTION_ALREADY_COMPLETED" }),
    });
  });
  await page.goto(`/e/summer-screening/join?t=${"x".repeat(24)}`);
  await expect(page.getByRole("dialog", { name: "您已完成本场选座" })).toBeVisible();
}

test("a completed repeat scan can immediately open today's records", async ({ page }) => {
  await openCompletedScan(page);
  const recordsRequest = page.waitForRequest((request) =>
    new URL(request.url()).pathname === "/records/today",
  );

  await page.getByRole("button", { name: "查看选座记录（5）" }).click();

  await recordsRequest;
});

test("a completed repeat scan automatically opens today's records after five seconds", async ({
  page,
}) => {
  await openCompletedScan(page);
  const recordsRequest = page.waitForRequest((request) =>
    new URL(request.url()).pathname === "/records/today",
  );

  await expect(page.getByRole("button", { name: "查看选座记录（1）" })).toBeVisible({
    timeout: 5_500,
  });
  await recordsRequest;
});

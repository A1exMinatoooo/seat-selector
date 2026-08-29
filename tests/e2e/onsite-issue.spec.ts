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

test("onsite issue closes with claimed and expired toasts", async ({ page }) => {
  test.skip(!adminPassword, "E2E_ADMIN_PASSWORD is required for authenticated mutation tests");
  await page.goto("/admin/events");
  await loginIfNeeded(page);
  await page.goto("/admin/events");

  const eventLinks = await page
    .locator(".event-list a")
    .evaluateAll((links) =>
      links.map((link) => (link as HTMLAnchorElement).getAttribute("href")).filter(Boolean),
    );
  let checkinUrl: string | undefined;
  for (const eventHref of eventLinks) {
    await page.goto(eventHref!);
    const checkinLink = page.getByRole("link", { name: "现场二维码" });
    if (!(await checkinLink.isVisible())) continue;
    await checkinLink.click();
    if (await page.getByText("现场发行", { exact: true }).isVisible()) {
      checkinUrl = page.url();
      break;
    }
  }
  test.skip(!checkinUrl, "An open onsite event is required for onsite issue browser coverage");

  let issueCount = 0;
  await page.route("**/api/admin/events/*/qr*", async (route) => {
    const request = route.request();
    if (request.method() === "POST") {
      issueCount += 1;
      const serverTime = new Date();
      const expiresIn = issueCount === 1 ? 30 : 0;
      await route.fulfill({
        json: {
          issueId: `00000000-0000-4000-8000-${String(issueCount).padStart(12, "0")}`,
          image: "data:image/png;base64,AA==",
          expiresIn,
          expiresAt: new Date(serverTime.getTime() + expiresIn * 1_000).toISOString(),
          serverTime: serverTime.toISOString(),
          allocation: [
            {
              id: "00000000-0000-4000-8000-000000000002",
              name: "普通票",
              quantity: 1,
            },
          ],
        },
      });
      return;
    }
    const issueId = new URL(request.url()).searchParams.get("issueId");
    await route.fulfill({ json: { status: issueId?.endsWith("000001") ? "claimed" : "expired" } });
  });

  await page.getByRole("radio", { name: "1" }).first().check();
  await page.getByRole("button", { name: "发行二维码" }).click();
  await expect(page.getByRole("status")).toHaveText("参与者已领取，共 1 张。");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("button", { name: "发行二维码" }).click();
  await expect(page.getByRole("alert")).toHaveText("二维码已超时，请重新发行。");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

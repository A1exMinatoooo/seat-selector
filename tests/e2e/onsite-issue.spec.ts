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
  let firstIssueStatusChecks = 0;
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
    if (issueId?.endsWith("000001")) {
      firstIssueStatusChecks += 1;
      await route.fulfill({
        json: { status: firstIssueStatusChecks === 1 ? "active" : "claimed" },
      });
      return;
    }
    await route.fulfill({ json: { status: "expired" } });
  });

  await page.getByRole("radio", { name: "1" }).first().check();
  await page.getByRole("button", { name: "发行二维码" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("现场二维码已发行，共 1 张。");
  const layering = await page.evaluate(() => {
    const toast = document.querySelector<HTMLElement>(".toast");
    const modal = document.querySelector<HTMLElement>(".lottery-backdrop");
    if (!toast || !modal) throw new Error("Expected toast and modal to be visible together");
    const toastRect = toast.getBoundingClientRect();
    const hit = document.elementFromPoint(
      toastRect.left + toastRect.width / 2,
      toastRect.top + toastRect.height / 2,
    );
    return {
      toast: Number(getComputedStyle(toast).zIndex),
      modal: Number(getComputedStyle(modal).zIndex),
      toastReceivesPointer: hit === toast || toast.contains(hit),
    };
  });
  expect(layering.toast).toBeGreaterThan(layering.modal);
  expect(layering.toastReceivesPointer).toBe(true);

  await expect(page.getByRole("status")).toHaveText("参与者已领取，共 1 张。");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("button", { name: "发行二维码" }).click();
  await expect(page.getByRole("alert")).toHaveText("二维码已超时，请重新发行。");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("linked onsite issue keeps zero-ticket follow-up events out of the QR snapshot", async ({
  page,
}) => {
  test.skip(!adminPassword, "E2E_ADMIN_PASSWORD is required for authenticated mutation tests");
  await page.goto("/admin/events");
  await loginIfNeeded(page);
  const eventLinks = await page
    .locator(".event-list a")
    .evaluateAll((links) =>
      links.map((link) => (link as HTMLAnchorElement).getAttribute("href")).filter(Boolean),
    );
  let found = false;
  for (const eventHref of eventLinks) {
    await page.goto(eventHref!);
    const checkinLink = page.getByRole("link", { name: "现场二维码" });
    if (!(await checkinLink.isVisible())) continue;
    await checkinLink.click();
    if ((await page.locator(".issue-event-group").count()) >= 2) {
      found = true;
      break;
    }
  }
  test.skip(!found, "An open onsite event with a linked follow-up is required");

  const groups = page.locator(".issue-event-group");
  const sourceName = (await groups.nth(0).getByRole("heading", { level: 2 }).textContent())!;
  let submitted: unknown;
  await page.route("**/api/admin/events/*/qr", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    submitted = route.request().postDataJSON();
    const serverTime = new Date();
    await route.fulfill({
      json: {
        issueId: "00000000-0000-4000-8000-000000000099",
        image: "data:image/png;base64,AA==",
        expiresIn: 30,
        expiresAt: new Date(serverTime.getTime() + 30_000).toISOString(),
        serverTime: serverTime.toISOString(),
        allocation: [
          {
            id: "00000000-0000-4000-8000-000000000002",
            ticketTypeId: "00000000-0000-4000-8000-000000000002",
            name: "普通票",
            quantity: 1,
          },
        ],
        events: [
          {
            eventId: "00000000-0000-4000-8000-000000000001",
            eventName: sourceName,
            ticketTotal: 1,
            allocation: [
              {
                id: "00000000-0000-4000-8000-000000000002",
                ticketTypeId: "00000000-0000-4000-8000-000000000002",
                name: "普通票",
                quantity: 1,
              },
            ],
          },
        ],
      },
    });
  });
  await groups.nth(0).locator('input[type="radio"][value="1"]').first().check();
  await page.getByRole("button", { name: "发行二维码" }).click();
  await expect(page.getByRole("dialog")).toContainText(sourceName);
  const allocations = (submitted as { allocations: Array<{ allocation: unknown[] }> }).allocations;
  expect(allocations[0]?.allocation).toHaveLength(1);
  expect(allocations[1]?.allocation).toHaveLength(0);
  await expect(page.getByRole("dialog").locator(".issue-event-summary section")).toHaveCount(1);
});

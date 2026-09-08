import { expect, test } from "@playwright/test";

for (const kind of ["editor", "preview", "event", "picker", "consecutive"]) {
  test(`${kind}: center and screen follow zoom and scroll without hiding`, async ({
    page,
  }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:3101/?kind=${kind}`);
    const dialog = page.getByRole("dialog");
    if (kind === "picker" || kind === "consecutive")
      await expect(dialog).toHaveCount(0, { timeout: 6000 });
    const viewport = page.locator(".seat-grid-viewport");
    const marker = viewport.locator(".seat-screen-marker");
    await expect(marker).toBeVisible();
    if (kind === "picker" || kind === "consecutive") {
      await expect(page.locator(".screen")).toHaveCount(0);
      await expect(page.locator(".seat-screen-marker")).toHaveCount(1);
      await expect(viewport.locator('[aria-label="银幕方向"]')).toHaveCount(1);
      await expect(page.getByText("银幕方向", { exact: true })).toHaveCount(1);
    }
    await viewport.scrollIntoViewIfNeeded();
    const geometry = () =>
      viewport.evaluate((element) => {
        const line = element
          .querySelector(".seat-grid-scaled-content > .seat-center-line")!
          .getBoundingClientRect();
        const marker = element.querySelector(".seat-screen-marker")!.getBoundingClientRect();
        const band = element.querySelector(".seat-screen-band")!.getBoundingClientRect();
        const anchor = element
          .querySelector('.seat-grid-scaled-content [data-seat-column="14"]')!
          .getBoundingClientRect();
        const next = element
          .querySelector('.seat-grid-scaled-content [data-seat-column="15"]')!
          .getBoundingClientRect();
        const body = element.querySelector(".seat-grid-viewport-body")!.getBoundingClientRect();
        return {
          delta: Math.abs(line.left + line.width / 2 - (anchor.right + next.left) / 2),
          markerLeft: marker.left,
          markerRight: marker.right,
          bandLeft: band.left,
          bandRight: band.right,
          bandBottom: band.bottom,
          bodyTop: body.top,
          markerTop: marker.top,
          markerBottom: marker.bottom,
        };
      });
    await expect.poll(async () => (await geometry()).delta).toBeLessThan(1.5);
    const initial = await geometry();
    expect(initial.bandBottom).toBeLessThanOrEqual(initial.bodyTop);
    expect(initial.markerBottom).toBeLessThanOrEqual(initial.bandBottom);
    await viewport.screenshot({ path: testInfo.outputPath(`${kind}-fit.png`) });
    await viewport.getByRole("button", { name: "恢复座位网格为百分之百" }).click();
    for (let i = 0; i < 5; i++)
      await viewport.getByRole("button", { name: "放大座位网格" }).click();
    await viewport.locator(".seat-grid-viewport-body").evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
      element.scrollTop = 200;
    });
    await expect(marker).toHaveAttribute("data-direction", "left");
    const moved = await geometry();
    expect(moved.markerRight - moved.markerLeft).toBeCloseTo(
      initial.markerRight - initial.markerLeft,
      1,
    );
    expect(moved.markerLeft).toBeGreaterThanOrEqual(moved.bandLeft);
    expect(moved.markerRight).toBeLessThanOrEqual(moved.bandRight);
    expect(Math.abs(moved.markerTop - initial.markerTop)).toBeLessThan(1);
    expect(moved.delta).toBeLessThan(1.5);
    await viewport.screenshot({ path: testInfo.outputPath(`${kind}-edge.png`) });
    await page.setViewportSize({ width: 420, height: 850 });
    await expect
      .poll(async () => {
        const g = await geometry();
        return g.markerRight <= g.bandRight;
      })
      .toBe(true);
    await viewport.getByRole("button", { name: "缩放以显示完整座位网格" }).click();
    await expect.poll(async () => (await geometry()).delta).toBeLessThan(1.5);
    expect(errors).toEqual([]);
  });
}

test("default boundary updates with column count and configured centers remain aligned", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:3101/?kind=editor&columns=10");
  const columnInput = page.getByRole("spinbutton", { name: "列数", exact: true });
  await expect(page.getByRole("spinbutton", { name: "中线位于第几列后" })).toHaveValue("5");
  await columnInput.fill("9");
  await columnInput.blur();
  await expect(page.getByRole("spinbutton", { name: "中线位于第几列后" })).toHaveValue("4");
  const payload = JSON.parse(await page.locator('input[name="layout"]').inputValue());
  expect(payload.centerAfterColumn).toBeNull();
  await page.goto("http://127.0.0.1:3101/?kind=preview&columns=30&center=3");
  await expect(page.locator(".seat-screen-marker")).toBeVisible();
  await expect
    .poll(() =>
      page.locator(".seat-grid-scaled-content").evaluate((element) => {
        const line = element.querySelector(".seat-center-line")!.getBoundingClientRect();
        const a = element.querySelector('[data-seat-column="3"]')!.getBoundingClientRect();
        const b = element.querySelector('[data-seat-column="4"]')!.getBoundingClientRect();
        return Math.abs(line.left + line.width / 2 - (a.right + b.left) / 2);
      }),
    )
    .toBeLessThan(1.5);
});

for (const kind of ["preview", "editor", "event", "picker", "consecutive"]) {
  test(`${kind}: a single-column default is before the first seat`, async ({ page }) => {
    await page.goto(`http://127.0.0.1:3101/?kind=${kind}&columns=1`);
    await expect(page.locator(".seat-screen-marker")).toBeVisible();
    await expect
      .poll(() =>
        page.locator(".seat-grid-scaled-content").evaluate((element) => {
          const line = element.querySelector(".seat-center-line")?.getBoundingClientRect();
          const seat = element.querySelector('[data-seat-column="0"]')?.getBoundingClientRect();
          return line && seat ? line.right < seat.left : false;
        }),
      )
      .toBe(true);
  });
}

test("changing the event hall uses that hall’s saved center", async ({ page }) => {
  await page.goto("http://127.0.0.1:3101/?kind=event");
  await page.getByRole("button", { name: /影厅/ }).click();
  await page.getByRole("option", { name: "偏置中线影厅" }).click();
  await expect
    .poll(() =>
      page.locator(".seat-grid-scaled-content").evaluate((element) => {
        const line = element.querySelector(".seat-center-line")!.getBoundingClientRect();
        const a = element.querySelector('[data-seat-column="3"]')!.getBoundingClientRect();
        const b = element.querySelector('[data-seat-column="4"]')!.getBoundingClientRect();
        return Math.abs(line.left + line.width / 2 - (a.right + b.left) / 2);
      }),
    )
    .toBeLessThan(1.5);
});

for (const kind of ["location-new", "location-edit"]) {
  test(`${kind}: location radius follows the switch without losing its value`, async ({ page }) => {
    await page.goto(`http://127.0.0.1:3101/?kind=${kind}`);
    await expect(page.getByLabel("活动地点")).toBeVisible();
    const toggle = page.getByRole("checkbox", { name: "开启活动定位检查" });
    const radius = page.locator('input[name="radiusMeters"]');
    if (kind === "location-new") {
      await expect(toggle).not.toBeChecked();
      await expect(radius).toBeHidden();
      await toggle.evaluate((element: HTMLInputElement) => element.click());
      await expect(radius).toBeVisible();
      await expect(radius).toHaveValue("1000");
    } else {
      await expect(toggle).toBeChecked();
      await expect(radius).toBeVisible();
      await expect(radius).toHaveValue("750");
    }
    await radius.fill("2500");
    await toggle.evaluate((element: HTMLInputElement) => element.click());
    await expect(radius).toBeHidden();
    await expect
      .poll(() =>
        page
          .locator('[data-testid="location-form"]')
          .evaluate((form) => new FormData(form as HTMLFormElement).get("radiusMeters")),
      )
      .toBe("2500");
  });
}

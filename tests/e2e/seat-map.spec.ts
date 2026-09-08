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
    await expect(viewport.locator(".seat-screen-band")).toHaveCount(0);
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
        const markerElement = element.querySelector<HTMLElement>(".seat-screen-marker")!;
        const marker = markerElement.getBoundingClientRect();
        const anchor = element
          .querySelector('.seat-grid-scaled-content [data-seat-column="14"]')!
          .getBoundingClientRect();
        const next = element
          .querySelector('.seat-grid-scaled-content [data-seat-column="15"]')!
          .getBoundingClientRect();
        const body = element.querySelector(".seat-grid-viewport-body")!.getBoundingClientRect();
        const firstSeat = element
          .querySelector(".seat-grid-scaled-content [data-seat-row-coordinate]")!
          .getBoundingClientRect();
        return {
          delta: Math.abs(line.left + line.width / 2 - (anchor.right + next.left) / 2),
          markerLeft: marker.left,
          markerRight: marker.right,
          bodyLeft: body.left,
          bodyRight: body.right,
          bodyTop: body.top,
          bodyBottom: body.bottom,
          firstSeatTop: firstSeat.top,
          markerTop: marker.top,
          markerBottom: marker.bottom,
          markerPointerEvents: getComputedStyle(markerElement).pointerEvents,
        };
      });
    await expect.poll(async () => (await geometry()).delta).toBeLessThan(1.5);
    const initial = await geometry();
    expect(initial.markerTop).toBeGreaterThanOrEqual(initial.bodyTop);
    expect(initial.markerBottom).toBeLessThan(initial.firstSeatTop);
    expect(initial.markerPointerEvents).toBe("none");
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
    expect(moved.markerLeft).toBeGreaterThanOrEqual(moved.bodyLeft);
    expect(moved.markerRight).toBeLessThanOrEqual(moved.bodyRight);
    expect(moved.markerBottom).toBeLessThanOrEqual(moved.bodyBottom);
    expect(Math.abs(moved.markerTop - initial.markerTop)).toBeLessThan(1);
    expect(moved.delta).toBeLessThan(1.5);
    await viewport.screenshot({ path: testInfo.outputPath(`${kind}-edge.png`) });
    await page.setViewportSize({ width: 420, height: 850 });
    await expect
      .poll(async () => {
        const g = await geometry();
        return g.markerRight <= g.bodyRight;
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

for (const kind of ["editor", "preview", "event", "picker", "consecutive"]) {
  test(`${kind}: trackpad pinch zooms around its focus in every interaction mode`, async ({
    page,
  }) => {
    await page.goto(`http://127.0.0.1:3101/?kind=${kind}`);
    if (kind === "editor") await page.getByRole("button", { name: "可选", exact: true }).click();
    if (kind === "event") await page.getByRole("button", { name: "调整可选区域" }).click();

    const viewport = page.locator(".seat-grid-viewport");
    const body = viewport.locator(".seat-grid-viewport-body");
    await viewport.getByRole("button", { name: "恢复座位网格为百分之百" }).click();
    const result = await body.evaluate(async (element) => {
      const viewport = element as HTMLDivElement;
      viewport.scrollLeft = 240;
      viewport.scrollTop = 120;
      const canvas = viewport.querySelector<HTMLElement>(".seat-grid-viewport-canvas")!;
      const scaleButton = viewport
        .closest(".seat-grid-viewport")!
        .querySelector<HTMLButtonElement>('[aria-label="恢复座位网格为百分之百"]')!;
      const rect = viewport.getBoundingClientRect();
      const localX = rect.width * 0.62;
      const localY = rect.height * 0.58;
      const contentPoint = () => ({
        x:
          (viewport.scrollLeft + localX - canvas.offsetLeft) /
          (Number.parseFloat(scaleButton.textContent!) / 100),
        y:
          (viewport.scrollTop + localY - canvas.offsetTop) /
          (Number.parseFloat(scaleButton.textContent!) / 100),
      });
      const before = contentPoint();
      const ordinaryWheel = new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        clientX: rect.left + localX,
        clientY: rect.top + localY,
        deltaY: 12,
      });
      viewport.dispatchEvent(ordinaryWheel);
      const pinchWheel = new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        clientX: rect.left + localX,
        clientY: rect.top + localY,
        ctrlKey: true,
        deltaY: -20,
      });
      viewport.dispatchEvent(pinchWheel);
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      const scale = Number.parseFloat(scaleButton.textContent!) / 100;
      const after = {
        x: (viewport.scrollLeft + localX - canvas.offsetLeft) / scale,
        y: (viewport.scrollTop + localY - canvas.offsetTop) / scale,
      };
      return {
        ordinaryPrevented: ordinaryWheel.defaultPrevented,
        pinchPrevented: pinchWheel.defaultPrevented,
        scale,
        focalDeltaX: Math.abs(before.x - after.x),
        focalDeltaY: Math.abs(before.y - after.y),
      };
    });
    expect(result.ordinaryPrevented).toBe(false);
    expect(result.pinchPrevented).toBe(true);
    expect(result.scale).toBeGreaterThan(1);
    expect(result.focalDeltaX).toBeLessThan(2);
    expect(result.focalDeltaY).toBeLessThan(2);
  });
}

for (const { kind, modes } of [
  { kind: "editor", modes: ["可选", "不可选", "黄金区", "过道", "空白"] },
  { kind: "event", modes: ["调整可选区域", "框选模式"] },
]) {
  test(`${kind}: trackpad pinch remains active in each editing mode`, async ({ page }) => {
    await page.goto(`http://127.0.0.1:3101/?kind=${kind}`);
    const viewport = page.locator(".seat-grid-viewport");
    const body = viewport.locator(".seat-grid-viewport-body");
    for (const mode of modes) {
      await page.getByRole("button", { name: mode, exact: true }).click();
      await viewport.getByRole("button", { name: "恢复座位网格为百分之百" }).click();
      await body.evaluate(async (element) => {
        const rect = element.getBoundingClientRect();
        element.dispatchEvent(
          new WheelEvent("wheel", {
            bubbles: true,
            cancelable: true,
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2,
            ctrlKey: true,
            deltaY: -10,
          }),
        );
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      });
      await expect(viewport.getByRole("button", { name: "恢复座位网格为百分之百" })).not.toHaveText(
        "100%",
      );
    }
  });
}

test("Safari gesture events zoom the seat map around the gesture focus", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "safari");
  await page.goto("http://127.0.0.1:3101/?kind=preview");
  const viewport = page.locator(".seat-grid-viewport");
  await viewport.getByRole("button", { name: "恢复座位网格为百分之百" }).click();
  const result = await viewport.locator(".seat-grid-viewport-body").evaluate(async (element) => {
    const body = element as HTMLDivElement;
    const rect = body.getBoundingClientRect();
    const dispatch = (type: string, scale: number) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperties(event, {
        clientX: { value: rect.left + rect.width / 2 },
        clientY: { value: rect.top + rect.height / 2 },
        scale: { value: scale },
      });
      body.dispatchEvent(event);
      return event.defaultPrevented;
    };
    const startPrevented = dispatch("gesturestart", 1);
    const changePrevented = dispatch("gesturechange", 1.3);
    dispatch("gestureend", 1.3);
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    return {
      startPrevented,
      changePrevented,
      scale: Number.parseFloat(
        body
          .closest(".seat-grid-viewport")!
          .querySelector<HTMLButtonElement>('[aria-label="恢复座位网格为百分之百"]')!.textContent!,
      ),
    };
  });
  expect(result.startPrevented).toBe(true);
  expect(result.changePrevented).toBe(true);
  expect(result.scale).toBe(130);
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

for (const kind of ["picker", "consecutive"]) {
  test(`${kind}: participant states use the new palette and one fixed row axis`, async ({
    page,
  }) => {
    await page.goto(`http://127.0.0.1:3101/?kind=${kind}&states=1&rows=4&columns=8`);
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 6000 });
    const viewport = page.locator(".public-grid-viewport");
    const seatCanvas = viewport.locator(".seat-grid-scaled-content");
    const seat = (state: string) => seatCanvas.locator(`[data-seat-state="${state}"]`).first();

    await expect(seat("available")).toHaveCSS("background-color", "rgb(232, 241, 237)");
    await expect(seat("available")).toHaveCSS("color", "rgb(23, 79, 66)");
    await expect(seat("golden")).toHaveCSS("background-color", "rgb(241, 247, 216)");
    await expect(seat("blocked")).toHaveCSS("background-color", "rgb(236, 238, 235)");
    await expect(seat("occupied")).toHaveCSS("background-color", "rgb(163, 59, 50)");

    if (kind === "picker") {
      await seatCanvas.locator('[data-seat-column="4"]').first().click();
    }
    await expect(seat("mine")).toHaveCSS("background-color", "rgb(23, 79, 66)");
    await expect(seat("mine")).toHaveCSS("color", "rgb(255, 255, 255)");

    await expect(viewport.locator(".seat-grid-fixed-y-axis-track")).toHaveCount(1);
    await expect(viewport.locator(".seat-grid-fixed-y-axis-label")).toHaveCount(4);
    await expect(seatCanvas.locator(".public-seat-coordinate").first()).toHaveCSS(
      "color",
      "rgba(0, 0, 0, 0)",
    );
    await expect(seatCanvas.locator(".public-seat-coordinate").first()).toHaveAttribute(
      "aria-hidden",
      "true",
    );

    const axisGeometry = () =>
      viewport.evaluate((element) => {
        const track = element
          .querySelector(".seat-grid-fixed-y-axis-track")!
          .getBoundingClientRect();
        const labels = [...element.querySelectorAll(".seat-grid-fixed-y-axis-label")].map((label) =>
          label.getBoundingClientRect(),
        );
        const rows = [
          ...element.querySelectorAll(
            ".seat-grid-scaled-content > .public-seat-grid .public-seat-coordinate",
          ),
        ].map((row) => row.getBoundingClientRect());
        return {
          trackTop: track.top,
          trackBottom: track.bottom,
          firstLabelDelta: Math.abs(labels[0]!.top - rows[0]!.top),
          lastLabelDelta: Math.abs(labels.at(-1)!.bottom - rows.at(-1)!.bottom),
        };
      });
    await expect.poll(async () => (await axisGeometry()).firstLabelDelta).toBeLessThan(1.5);
    await viewport.getByRole("button", { name: "放大座位网格" }).click();
    await viewport.locator(".seat-grid-viewport-body").evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
      element.scrollTop = 40;
    });
    await expect
      .poll(async () => {
        const geometry = await axisGeometry();
        return Math.max(geometry.firstLabelDelta, geometry.lastLabelDelta);
      })
      .toBeLessThan(1.5);
    const moved = await axisGeometry();
    expect(moved.trackBottom).toBeGreaterThan(moved.trackTop);
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

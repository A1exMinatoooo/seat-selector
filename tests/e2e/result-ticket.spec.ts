import { expect, test } from "@playwright/test";

const fixtureUrl = "http://127.0.0.1:3101";
const seats = ["A排1座", "A排2座", "A排3座", "A排4座", "A排5座", "A排6座"];
const longLabel = "电影主题限定纪念礼盒（含角色海报、收藏徽章及纪念明信片）";

for (const width of [320, 390]) {
  test(`long reservation details remain readable without horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${fixtureUrl}/?kind=success&long=1`);

    await expect(page.getByRole("heading", { name: `${longLabel} · 夏日特别放映活动完整名称` })).toBeVisible();
    await expect(page.getByText(`${longLabel} · 普通票`)).toBeVisible();
    for (const seat of seats) await expect(page.getByText(seat, { exact: true })).toBeVisible();
    await expect(page.getByText(longLabel, { exact: true })).toBeVisible();

    const notice = page.locator(".success-notice-text");
    await expect(notice).toHaveText("请截图保存本页，方便后续核对座位");
    const pillFitsOneLine = await notice.evaluate((element) => {
      const style = getComputedStyle(element);
      const lineHeight = Number.parseFloat(style.lineHeight);
      return element.scrollWidth <= element.clientWidth && element.clientHeight <= lineHeight * 1.25;
    });
    expect(pillFitsOneLine).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}

test("today's tickets keep each reservation's lottery results isolated", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${fixtureUrl}/?kind=today`);

  const tickets = page.locator(".today-records-list .reservation-ticket");
  await expect(tickets).toHaveCount(2);
  await expect(tickets.nth(0).getByRole("heading", { name: "晚场" })).toBeVisible();
  await expect(tickets.nth(0).getByText("B排8座")).toBeVisible();
  await expect(tickets.nth(0).getByText("学生票 × 1")).toBeVisible();
  await expect(tickets.nth(0).getByRole("region", { name: "抽奖结果" })).toHaveCount(0);

  await expect(tickets.nth(1).getByRole("heading", { name: "午场" })).toBeVisible();
  await expect(tickets.nth(1).getByText("海报")).toBeVisible();
  await expect(tickets.nth(1).getByText("未中奖")).toBeVisible();
  await expect(tickets.nth(0).getByText("海报")).toHaveCount(0);
});

test("records empty states distinguish a missing device from no reservations", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${fixtureUrl}/?kind=records-missing`);
  await expect(page.getByRole("heading", { name: "未识别到当前设备" })).toBeVisible();
  await expect(page.getByText("请使用完成选座时的同一微信扫描“今日选座记录”二维码。")).toBeVisible();
  await expect(page.locator(".reservation-ticket")).toHaveCount(0);

  await page.goto(`${fixtureUrl}/?kind=records-empty`);
  await expect(page.getByRole("heading", { name: "今日暂无选座记录" })).toBeVisible();
  await expect(page.getByText("当前设备今天还没有完成选座。")).toBeVisible();
  await expect(page.locator(".reservation-ticket")).toHaveCount(0);
});

test("ticket states distinguish winning, all-losing, and no lottery results", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${fixtureUrl}/?kind=ticket-states`);

  const tickets = page.locator(".ticket-states-fixture .reservation-ticket");
  await expect(tickets).toHaveCount(3);
  const winning = tickets.nth(0).getByRole("region", { name: "抽奖结果" });
  await expect(winning.getByRole("heading", { name: "中奖奖品" })).toBeVisible();
  await expect(winning.getByText(longLabel)).toBeVisible();
  await expect(winning.getByText("海报", { exact: true })).toBeVisible();
  await expect(tickets.nth(1).getByRole("region", { name: "抽奖结果" })).toContainText("未中奖");
  await expect(tickets.nth(1).getByText("海报")).toHaveCount(0);
  await expect(tickets.nth(2).getByRole("region", { name: "抽奖结果" })).toHaveCount(0);
  for (const seat of seats) await expect(tickets.nth(0).getByText(seat, { exact: true })).toBeVisible();
  await expect(tickets.nth(1).locator(".ticket-prizes-winning")).toHaveCount(0);
  await expect(tickets.nth(1).locator(".ticket-prizes-losing")).toBeVisible();
});

test("consecutive results retain step order, historical marker, and completed outcomes", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${fixtureUrl}/?kind=result-consecutive`);

  const result = page.locator(".consecutive-result-list");
  const tickets = result.locator("article.reservation-ticket");
  await expect(tickets).toHaveCount(2);
  const labels = await tickets.locator("h2").allTextContents();
  expect(labels).toEqual(["连续首场", "连续后场"]);
  await expect(result.getByText("此前已完成")).toBeVisible();
  await expect(tickets.nth(0).getByText("A排1座")).toBeVisible();
  await expect(tickets.nth(0).getByText("A排2座")).toBeVisible();
  await expect(tickets.nth(1).getByText("B排8座")).toBeVisible();
  await expect(tickets.nth(0).getByText("海报")).toBeVisible();
  await expect(tickets.nth(1).getByRole("region", { name: "抽奖结果" })).toHaveCount(0);
});


test("completion settles new tickets once and leaves historical and recorded tickets still", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(`${fixtureUrl}/?kind=success`);
  const ticket = page.getByRole("article");
  await expect(ticket.getByText("A排1座", { exact: true })).toBeVisible();
  const clock = page.locator(".live-time strong");
  const initialClock = await clock.textContent();
  const startTime = await ticket.evaluate(async (element) => {
    const animation = element.getAnimations()[0];
    if (!animation) throw new Error("Newly completed ticket did not settle");
    await animation.finished;
    return animation.startTime;
  });
  await expect.poll(() => clock.textContent()).not.toBe(initialClock);
  expect(await ticket.evaluate((element) => element.getAnimations()[0]?.startTime)).toBe(startTime);

  await page.goto(`${fixtureUrl}/?kind=result-consecutive`);
  const tickets = page.getByRole("article");
  await expect(tickets).toHaveCount(2);
  expect(await tickets.nth(0).evaluate((element) => element.getAnimations().length)).toBe(1);
  expect(await tickets.nth(1).evaluate((element) => element.getAnimations().length)).toBe(0);
  await page.goto(`${fixtureUrl}/?kind=today`);
  await expect(page.getByRole("article")).toHaveCount(2);
  expect(await page.getByRole("article").evaluateAll((elements) => elements.every((element) => element.getAnimations().length === 0))).toBe(true);
});

test("reduced motion keeps completion static and immediately readable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${fixtureUrl}/?kind=result-consecutive`);
  await expect(page.getByText("A排1座", { exact: true })).toBeVisible();
  expect(await page.getByRole("article").evaluateAll((elements) => elements.every((element) => element.getAnimations().length === 0 && getComputedStyle(element).transform === "none"))).toBe(true);
});

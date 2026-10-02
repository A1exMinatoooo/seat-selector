import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { and, eq, sql } from "drizzle-orm";
import { appEnvironment, loadLocalTestConfig } from "../../scripts/local-test/config";
import { withLocalTestDb } from "../../src/server/db/local-test-database";
import {
  readLocalTestFixtureManifest,
  type LocalTestFixtureManifest,
} from "../../src/server/db/local-test-seed";
import {
  consecutiveCheckinSeatHolds,
  consecutiveCheckinWorkflows,
  eventAuditLogs,
  lotteryDraws,
  lotteryPrizes,
  participantTickets,
  participants,
  reservationSeats,
  reservations,
  events,
  ticketIssues,
} from "../../src/server/db/schema";
import { formatSeatLabel } from "../../src/shared/seat-label";
import { decodeQrUrl } from "./local-qr";

type JsonResult = { response: { status: number }; body: Record<string, unknown> };
const localMode = process.env.LOCAL_TEST_E2E === "1";
const codes = {
  base: "local-preregistered",
  onsite: "local-onsite-single",
  location: "local-location-check",
  lottery: "local-lottery-demo",
  left: "local-half-left-lock",
  right: "local-half-right-lock",
  consecutiveA: "local-consecutive-a",
  consecutiveB: "local-consecutive-b",
  draft: "local-draft-status",
  ended: "local-ended-status",
} as const;

let fixture: LocalTestFixtureManifest;
let eventIds: Record<string, string>;
let ticketIds: Record<string, Record<string, string>>;
let seatIds: Record<string, string>;
let participantIds: Record<string, Record<string, string>>;
let baseURL: string;
function required<T>(value: T | undefined, name: string): T {
  if (value === undefined) throw new Error(`Local fixture is missing ${name}`);
  return value;
}
function seatDisplayName(shortLabel: string) {
  const match = /^([A-F])(\d+)$/.exec(shortLabel);
  if (!match?.[1] || !match[2]) throw new Error(`Invalid fixture seat label: ${shortLabel}`);
  return formatSeatLabel(match[1], match[2]);
}
async function jsonRequest(
  page: Page,
  path: string,
  method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
  body?: unknown,
): Promise<JsonResult> {
  return page.evaluate(
    async ({ path, method, body }) => {
      const response = await fetch(path, {
        method,
        headers: body === undefined ? undefined : { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: "no-store",
      });
      return { response: { status: response.status }, body: await response.json() };
    },
    { path, method, body },
  );
}

async function startFreshContext(
  browser: Browser,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ baseURL, storageState: undefined });
  return { context, page: await context.newPage() };
}

async function issueRealQr(admin: Page, eventCode: string, payload?: unknown) {
  const id = required(eventIds[eventCode], `event ${eventCode}`);
  const result = payload
    ? await jsonRequest(admin, `/api/admin/events/${id}/qr`, "POST", payload)
    : await jsonRequest(admin, `/api/admin/events/${id}/qr`);
  expect(result.response.status).toBe(200);
  const url = decodeQrUrl(String(result.body.image));
  const parsed = new URL(url);
  expect(parsed.origin).toBe(baseURL);
  expect(parsed.pathname).toBe(`/e/${eventCode}/join`);
  return url;
}

async function enterThroughQr(
  page: Page,
  qrUrl: string,
  tail: string,
  remainder?: string,
  nickname?: string,
) {
  await page.goto(qrUrl);
  await expect(page.getByRole("heading", { name: "确认参与身份" })).toBeVisible();
  await page.getByLabel("手机尾号").fill(tail);
  await page.getByRole("button", { name: "继续" }).click();
  const fullPhone = page.getByLabel(`手机号尾号 ${tail} 前的剩余数字`);
  if (remainder) {
    await expect(fullPhone).toBeVisible();
    await fullPhone.fill(remainder);
    await page.getByRole("button", { name: "继续" }).click();
  }
  if (nickname) await page.getByRole("option", { name: new RegExp(nickname) }).click();
  await expect(
    page
      .getByRole("button", { name: "确认选座" })
      .or(page.getByRole("heading", { name: "验证现场位置" })),
  ).toBeVisible({ timeout: 15_000 });
  await dismissTheaterManners(page);
}

async function dismissTheaterManners(page: Page) {
  const manners = page.getByRole("dialog", { name: "文明观影须知" });
  if (await manners.count()) await manners.getByRole("button", { name: "关闭" }).click();
}

async function selectSeat(page: Page, ...labels: string[]) {
  for (const label of labels)
    await page.getByRole("button", { name: `${seatDisplayName(label)}：可选` }).click();
}

async function confirmViaUi(page: Page, ...labels: string[]) {
  await selectSeat(page, ...labels);
  await page.getByRole("button", { name: "确认选座" }).click();
  for (const label of labels)
    await expect(page.getByText(seatDisplayName(label), { exact: true }).first()).toBeVisible({
      timeout: 20_000,
    });
}

async function participantApi(
  page: Page,
  code: string,
  action: string,
  method: "GET" | "POST" | "PUT" | "DELETE" = "POST",
  body?: unknown,
) {
  return jsonRequest(page, `/api/events/${code}/${action}`, method, body);
}

async function assertE2eDatabaseIsMarked() {
  const config = loadLocalTestConfig();
  const expected = appEnvironment(config, "e2e").DATABASE_URL;
  if (!expected || process.env.DATABASE_URL !== expected)
    throw new Error("LOCAL_TEST_E2E DATABASE_URL does not match the isolated e2e database");
  await withLocalTestDb(
    { port: config.dbPort, password: config.databasePassword, target: "e2e" },
    async (db) => {
      fixture = await readLocalTestFixtureManifest(db);
      const result = await db.execute(
        sql`SELECT shobj_description(oid, 'pg_database') AS comment
            FROM pg_database WHERE datname = current_database()`,
      );
      if (result.rows[0]?.comment !== "pick-your-seat:local-test:v1:seeded")
        throw new Error("The dedicated e2e database marker is not seeded");
      eventIds = fixture.eventIds;
      ticketIds = fixture.ticketTypeIds;
      seatIds = fixture.seatIds;
      participantIds = fixture.participantIds;
    },
  );
}

test("real QR business journey preserves identity, allocation, seating, location, lottery and consecutive rules", async ({
  browser,
  page,
}, testInfo) => {
  test.skip(
    !localMode || testInfo.project.name !== "desktop",
    "Only runs once in desktop Chromium against the isolated local:e2e database",
  );
  testInfo.setTimeout(180_000);
  await assertE2eDatabaseIsMarked();
  baseURL = required(process.env.E2E_BASE_URL, "E2E_BASE_URL");
  await page.goto("/e/local-preregistered/join");
  await expect(page.getByRole("alert")).toBeVisible();
  await page.goto("/e/local-preregistered");
  await expect(page.getByRole("heading", { name: "请扫描现场二维码" })).toBeVisible();
  await page.goto("/admin/events");
  await expect(page.getByRole("heading").first()).toBeVisible();

  const contexts: BrowserContext[] = [];
  const fresh = async () => {
    const participant = await startFreshContext(browser);
    contexts.push(participant.context);
    return participant.page;
  };

  try {
    // 1. Preregistered two-seat selection, conflict, then a second seat and idempotent confirmation.
    const baseQr = await issueRealQr(page, codes.base);
    const twoTicket = await fresh();
    await enterThroughQr(twoTicket, baseQr, "9002");
    const baseEventId = required(eventIds[codes.base], "base event");
    const versionBefore = await withLocalTestDb(
      {
        port: loadLocalTestConfig().dbPort,
        password: loadLocalTestConfig().databasePassword,
        target: "e2e",
      },
      async (db) => {
        const [event] = await db
          .select({ version: events.version })
          .from(events)
          .where(eq(events.id, baseEventId));
        return required(event?.version, "base event version");
      },
    );
    await confirmViaUi(twoTicket, "B2", "B3");
    await expect(twoTicket.getByText("普通票 × 1")).toBeVisible();
    await expect(twoTicket.getByText("学生票 × 1")).toBeVisible();
    const twoTicketId = required(
      participantIds[codes.base]?.["测试双人"],
      "two-ticket participant",
    );
    await withLocalTestDb(
      {
        port: loadLocalTestConfig().dbPort,
        password: loadLocalTestConfig().databasePassword,
        target: "e2e",
      },
      async (db) => {
        const [reservation] = await db
          .select()
          .from(reservations)
          .where(
            and(eq(reservations.eventId, baseEventId), eq(reservations.participantId, twoTicketId)),
          );
        expect(reservation).toBeDefined();
        expect(
          await db
            .select()
            .from(reservationSeats)
            .where(
              eq(reservationSeats.reservationId, required(reservation?.id, "two-seat reservation")),
            ),
        ).toHaveLength(2);
        const [event] = await db
          .select({ version: events.version })
          .from(events)
          .where(eq(events.id, baseEventId));
        expect(event?.version).toBe(versionBefore + 1);
      },
    );

    const singleQr = await issueRealQr(page, codes.base);
    const oneTicket = await fresh();
    await enterThroughQr(oneTicket, singleQr, "9001");
    const b2 = required(seatIds["B2"], "B2 seat");
    const conflict = await participantApi(oneTicket, codes.base, "confirm", "POST", {
      seatIds: [required(b2, "B2 seat")],
    });
    expect(conflict.response.status).toBe(409);
    expect(conflict.body.error).toBe("SEAT_CONFLICT");
    const singleParticipantId = required(
      participantIds[codes.base]?.["测试单人"],
      "single-seat participant",
    );
    await withLocalTestDb(
      {
        port: loadLocalTestConfig().dbPort,
        password: loadLocalTestConfig().databasePassword,
        target: "e2e",
      },
      async (db) => {
        expect(
          await db
            .select()
            .from(reservations)
            .where(
              and(
                eq(reservations.eventId, required(eventIds[codes.base], "base event")),
                eq(reservations.participantId, singleParticipantId),
              ),
            ),
        ).toHaveLength(0);
      },
    );
    const b4 = required(seatIds["B4"], "B4 seat");
    await confirmViaUi(oneTicket, "B4");
    const repeated = await participantApi(oneTicket, codes.base, "confirm", "POST", {
      seatIds: [required(b4, "B4 seat")],
    });
    expect(repeated.response.status).toBe(409);
    await withLocalTestDb(
      {
        port: loadLocalTestConfig().dbPort,
        password: loadLocalTestConfig().databasePassword,
        target: "e2e",
      },
      async (db) => {
        const singleReservations = await db
          .select()
          .from(reservations)
          .where(
            and(
              eq(reservations.eventId, baseEventId),
              eq(reservations.participantId, singleParticipantId),
            ),
          );
        expect(singleReservations).toHaveLength(1);
        expect(
          await db
            .select()
            .from(reservationSeats)
            .where(
              eq(
                reservationSeats.reservationId,
                required(singleReservations[0]?.id, "single-seat reservation"),
              ),
            ),
        ).toHaveLength(1);
      },
    );

    // 2. Same-tail identities require explicit full-phone or candidate resolution.
    const collisionQr = await issueRealQr(page, codes.base);
    const collisionFull = await fresh();
    await collisionFull.goto(collisionQr);
    await collisionFull.getByLabel("手机尾号").fill("8001");
    await collisionFull.getByRole("button", { name: "继续" }).click();
    const fullPhone = collisionFull.getByLabel("手机号尾号 8001 前的剩余数字");
    await fullPhone.fill("0000002");
    const mismatchResponsePromise = collisionFull.waitForResponse(
      (response) => new URL(response.url()).pathname === "/api/identity/resolve",
    );
    await collisionFull.getByRole("button", { name: "继续" }).click();
    const mismatchResponse = await mismatchResponsePromise;
    expect(mismatchResponse.status()).toBe(404);
    expect((await mismatchResponse.json()).error).toBe("IDENTITY_MISMATCH");
    await fullPhone.fill("0000000");
    await collisionFull.getByRole("button", { name: "继续" }).click();
    await expect(collisionFull.getByRole("button", { name: "确认选座" })).toBeVisible();
    const tailQr = await issueRealQr(page, codes.base);
    const collisionTail = await fresh();
    await enterThroughQr(collisionTail, tailQr, "8001", undefined, "碰撞尾号");
    const choiceQr = await issueRealQr(page, codes.base);
    const choice = await fresh();
    await enterThroughQr(choice, choiceQr, "8002", undefined, "候选尾号乙");
    await withLocalTestDb(
      {
        port: loadLocalTestConfig().dbPort,
        password: loadLocalTestConfig().databasePassword,
        target: "e2e",
      },
      async (db) => {
        const full = await db
          .select()
          .from(participants)
          .where(
            eq(
              participants.id,
              required(participantIds[codes.base]?.["碰撞完整甲"], "full-phone identity"),
            ),
          );
        const tail = await db
          .select()
          .from(participants)
          .where(
            eq(
              participants.id,
              required(participantIds[codes.base]?.["碰撞尾号"], "tail identity"),
            ),
          );
        const selectedChoice = await db
          .select()
          .from(participants)
          .where(
            eq(
              participants.id,
              required(
                participantIds[codes.base]?.["候选尾号乙"],
                "chosen duplicate-tail identity",
              ),
            ),
          );
        expect(full[0]?.deviceHash).toBeTruthy();
        expect(tail[0]?.deviceHash).toBeTruthy();
        expect(selectedChoice[0]?.deviceHash).toBeTruthy();
        expect(
          new Set([full[0]?.deviceHash, tail[0]?.deviceHash, selectedChoice[0]?.deviceHash]).size,
        ).toBe(3);
      },
    );
    // 3. Import behavior is exercised through the admin CSV UI and both fixture files.
    const importEventId = required(eventIds[codes.base], "base event");
    await page.goto(`/admin/events/${importEventId}/participants`);
    const validCsv = page.locator('input[type="file"]');
    await validCsv.setInputFiles("_local-test/fixtures/import-valid.csv");
    await page.getByRole("button", { name: /导入/ }).click();
    await expect(page.getByRole("status")).toHaveText(/已导入 2 位参与者/);
    await validCsv.setInputFiles("_local-test/fixtures/import-invalid.csv");
    await page.getByRole("button", { name: /导入/ }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await withLocalTestDb(
      {
        port: loadLocalTestConfig().dbPort,
        password: loadLocalTestConfig().databasePassword,
        target: "e2e",
      },
      async (db) => {
        const people = await db
          .select()
          .from(participants)
          .where(eq(participants.eventId, importEventId));
        expect(people).toHaveLength(14);
        const importedOne = people.find((person) => person.phoneDigits === "9101");
        const importedTwo = people.find((person) => person.phoneDigits === "9102");
        expect(importedOne?.ticketTotal).toBe(1);
        expect(importedTwo?.ticketTotal).toBe(2);
        const ordinary = required(ticketIds[codes.base]?.["普通票"], "ordinary ticket type");
        const student = required(ticketIds[codes.base]?.["学生票"], "student ticket type");
        expect(
          await db
            .select()
            .from(participantTickets)
            .where(
              and(
                eq(participantTickets.participantId, required(importedOne?.id, "imported 9101")),
                eq(participantTickets.ticketTypeId, ordinary),
              ),
            ),
        ).toMatchObject([{ quantity: 1 }]);
        expect(
          await db
            .select()
            .from(participantTickets)
            .where(
              and(
                eq(participantTickets.participantId, required(importedTwo?.id, "imported 9102")),
                eq(participantTickets.ticketTypeId, student),
              ),
            ),
        ).toMatchObject([{ quantity: 2 }]);
      },
    );

    // 4. Onsite QR allocations issue two ticket types and are single-claim.
    const onsiteTickets = ticketIds[codes.onsite] ?? {};
    const onsiteAllocation = [
      { ticketTypeId: required(onsiteTickets["普通票"], "onsite ordinary ticket"), quantity: 1 },
      { ticketTypeId: required(onsiteTickets["学生票"], "onsite student ticket"), quantity: 1 },
    ];
    const onsiteQr = await issueRealQr(page, codes.onsite, { allocation: onsiteAllocation });
    const onsite = await fresh();
    await onsite.goto(onsiteQr);
    await expect(onsite.getByRole("button", { name: "确认选座" })).toBeVisible({ timeout: 20_000 });
    await dismissTheaterManners(onsite);
    await confirmViaUi(onsite, "C2", "C3");
    const claimAgain = await fresh();
    const secondClaim = claimAgain.waitForResponse(
      (response) => new URL(response.url()).pathname === "/api/entry/redeem",
    );
    await claimAgain.goto(onsiteQr);
    const rejectedClaim = await secondClaim;
    expect(rejectedClaim.status()).toBe(409);
    expect(await rejectedClaim.json()).toMatchObject({ error: "TICKET_ISSUE_CLAIMED" });
    await expect(claimAgain.getByRole("heading", { name: "二维码已被领取" })).toBeVisible();
    await withLocalTestDb(
      {
        port: loadLocalTestConfig().dbPort,
        password: loadLocalTestConfig().databasePassword,
        target: "e2e",
      },
      async (db) => {
        const onsiteEventId = required(eventIds[codes.onsite], "onsite event");
        const issuedPeople = await db
          .select()
          .from(participants)
          .where(and(eq(participants.eventId, onsiteEventId), eq(participants.source, "onsite")));
        expect(issuedPeople).toHaveLength(1);
        expect(issuedPeople[0]?.ticketTotal).toBe(2);
        const ticketRows = await db
          .select()
          .from(participantTickets)
          .where(
            eq(
              participantTickets.participantId,
              required(issuedPeople[0]?.id, "issued participant"),
            ),
          );
        expect(ticketRows).toHaveLength(2);
        expect(ticketRows.reduce((sum, ticket) => sum + ticket.quantity, 0)).toBe(2);
        const issueRows = await db
          .select()
          .from(ticketIssues)
          .where(
            eq(ticketIssues.participantId, required(issuedPeople[0]?.id, "issued participant")),
          );
        expect(issueRows).toHaveLength(1);
        expect(issueRows[0]?.consumedAt).not.toBeNull();
      },
    );

    // 5. Geofence is enforced server-side; the seeded exempt identity can proceed without verification.
    const locationQr = await issueRealQr(page, codes.location);
    const locationUser = await fresh();
    await locationUser.context().grantPermissions(["geolocation"], { origin: baseURL });
    await locationUser.context().setGeolocation({ latitude: 0, longitude: 0, accuracy: 10 });
    await enterThroughQr(locationUser, locationQr, "9001");
    const far = await jsonRequest(locationUser, "/api/location/verify", "POST", {
      latitude: 1,
      longitude: 1,
      accuracy: 10,
      capturedAt: Date.now(),
    });
    expect(far.response.status).toBe(403);
    expect(far.body.error).toBe("LOCATION_REQUIRED");
    const near = await jsonRequest(locationUser, "/api/location/verify", "POST", {
      latitude: 0,
      longitude: 0,
      accuracy: 10,
      capturedAt: Date.now(),
    });
    expect(near.response.status).toBe(200);
    await locationUser.goto(`/e/${codes.location}`);
    await dismissTheaterManners(locationUser);
    await confirmViaUi(locationUser, "D2");
    const locationParticipantId = required(
      participantIds[codes.location]?.["测试单人"],
      "location participant",
    );
    await withLocalTestDb(
      {
        port: loadLocalTestConfig().dbPort,
        password: loadLocalTestConfig().databasePassword,
        target: "e2e",
      },
      async (db) => {
        const audits = await db
          .select()
          .from(eventAuditLogs)
          .where(eq(eventAuditLogs.participantId, locationParticipantId));
        expect(audits).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              action: "location_rejected",
              details: expect.objectContaining({
                stage: "server",
                reason: "outside_range",
                radiusMeters: 500,
              }),
            }),
            expect.objectContaining({
              action: "location_verified",
              details: expect.objectContaining({
                distanceMeters: 0,
                accuracyMeters: 10,
                radiusMeters: 500,
                exempt: false,
              }),
            }),
          ]),
        );
      },
    );
    const exemptQr = await issueRealQr(page, codes.location);
    const exempt = await fresh();
    await enterThroughQr(exempt, exemptQr, "9004");
    await confirmViaUi(exempt, "D3");

    // 6. Lottery creation is repeatable; an ordinary-ticket identity is denied.
    const lotteryQr = await issueRealQr(page, codes.lottery);
    const lotteryUser = await fresh();
    await enterThroughQr(lotteryUser, lotteryQr, "9002");
    await confirmViaUi(lotteryUser, "E2", "E3");
    await lotteryUser.getByRole("button", { name: /确定，开始抽奖/ }).click();
    await expect(lotteryUser.getByRole("button", { name: /关闭/ })).toBeVisible({
      timeout: 30_000,
    });
    const lotteryAgain = await participantApi(lotteryUser, codes.lottery, "lottery");
    expect(lotteryAgain.response.status).toBe(200);
    const lotteryRepeat = await participantApi(lotteryUser, codes.lottery, "lottery");
    expect(lotteryRepeat.body.results).toEqual(lotteryAgain.body.results);
    const results = await withLocalTestDb(
      {
        port: loadLocalTestConfig().dbPort,
        password: loadLocalTestConfig().databasePassword,
        target: "e2e",
      },
      async (db) => ({
        draws: await db
          .select()
          .from(lotteryDraws)
          .where(
            eq(
              lotteryDraws.participantId,
              required(participantIds[codes.lottery]?.["测试双人"], "lottery participant"),
            ),
          ),
        prizes: await db
          .select({ name: lotteryPrizes.name, quantity: lotteryPrizes.quantity })
          .from(lotteryPrizes)
          .where(eq(lotteryPrizes.eventId, required(eventIds[codes.lottery], "lottery event"))),
      }),
    );
    expect(results.draws).toHaveLength(2);
    expect(lotteryAgain.body.results).toHaveLength(2);
    const prizeCounts = new Map<string, number>();
    for (const draw of results.draws) {
      if (draw.prizeName !== null)
        prizeCounts.set(draw.prizeName, (prizeCounts.get(draw.prizeName) ?? 0) + 1);
      expect(
        draw.prizeName === null || results.prizes.some((prize) => prize.name === draw.prizeName),
      ).toBe(true);
    }
    for (const prize of results.prizes)
      expect(prizeCounts.get(prize.name) ?? 0).toBeLessThanOrEqual(prize.quantity);
    const ineligibleQr = await issueRealQr(page, codes.lottery);
    const ineligible = await fresh();
    await enterThroughQr(ineligible, ineligibleQr, "9004");
    await confirmViaUi(ineligible, "F2");
    const unavailable = await participantApi(ineligible, codes.lottery, "lottery");
    expect(unavailable.response.status).toBe(409);
    expect(unavailable.body.error).toBe("LOTTERY_UNAVAILABLE");
    const ineligibleParticipantId = required(
      participantIds[codes.lottery]?.["测试豁免"],
      "ineligible lottery participant",
    );
    const ineligibleDraws = await withLocalTestDb(
      {
        port: loadLocalTestConfig().dbPort,
        password: loadLocalTestConfig().databasePassword,
        target: "e2e",
      },
      async (db) =>
        db
          .select()
          .from(lotteryDraws)
          .where(eq(lotteryDraws.participantId, ineligibleParticipantId)),
    );
    expect(ineligibleDraws).toHaveLength(0);

    // 7. Half-lock UI and server constraints must agree on both directions.
    for (const [code, forbidden, allowed] of [
      [codes.left, "A2", "A6"],
      [codes.right, "A6", "A2"],
    ] as const) {
      const qr = await issueRealQr(page, code);
      const participant = await fresh();
      await enterThroughQr(participant, qr, "9001");
      await expect(
        participant.getByRole("button", { name: `${seatDisplayName(forbidden)}：不可选` }),
      ).toBeDisabled();
      const id = required(seatIds[forbidden], `${forbidden} seat`);
      const denied = await participantApi(participant, code, "confirm", "POST", { seatIds: [id] });
      expect(denied.response.status).toBe(400);
      expect(denied.body.error).toBe("VALIDATION_ERROR");
      await confirmViaUi(participant, allowed);
    }

    // 8. Linked issue launches two real contexts, held-seat conflict and UI finalization.
    const eventA = required(eventIds[codes.consecutiveA], "consecutive A");
    const eventB = required(eventIds[codes.consecutiveB], "consecutive B");
    const typeA = required(
      ticketIds[codes.consecutiveA]?.["抽奖票"],
      "consecutive lottery ticket A",
    );
    const typeB = required(
      ticketIds[codes.consecutiveB]?.["抽奖票"],
      "consecutive lottery ticket B",
    );
    const allocation = {
      allocations: [
        { eventId: eventA, allocation: [{ ticketTypeId: typeA, quantity: 1 }] },
        { eventId: eventB, allocation: [{ ticketTypeId: typeB, quantity: 1 }] },
      ],
    };
    const linkedQr = await issueRealQr(page, codes.consecutiveA, allocation);
    const prepareWorkflowPage = async (qr: string) => {
      const participant = await fresh();
      await participant.goto(qr);
      const locate = participant.getByRole("button", { name: /允许定位并开始选座/ });
      if (await locate.count()) await locate.click();
      const manners = participant.getByRole("dialog", { name: "文明观影须知" });
      await expect(manners).toBeVisible({ timeout: 2_000 });
      await dismissTheaterManners(participant);
      await expect(
        participant.getByRole("button", { name: `${seatDisplayName("B2")}：可选` }),
      ).toBeVisible({ timeout: 20_000 });
      return participant;
    };
    const workflowA = await prepareWorkflowPage(linkedQr);
    const workflowBQr = await issueRealQr(page, codes.consecutiveA, allocation);
    const workflowB = await prepareWorkflowPage(workflowBQr);
    const seatA = required(seatIds["B2"], "consecutive A B2");
    const seatB = required(seatIds["B2"], "consecutive B B2");
    const holdA1 = await participantApi(workflowA, codes.consecutiveA, "workflow/holds", "PUT", {
      eventId: eventA,
      seatIds: [seatA],
    });
    expect(holdA1.response.status).toBe(200);
    const holdA2 = await participantApi(workflowA, codes.consecutiveA, "workflow/holds", "PUT", {
      eventId: eventB,
      seatIds: [seatB],
    });
    expect(holdA2.response.status).toBe(200);
    const holdB = await participantApi(workflowB, codes.consecutiveA, "workflow/holds", "PUT", {
      eventId: eventB,
      seatIds: [seatB],
    });
    expect(holdB.response.status).toBe(409);
    expect(holdB.body.error).toBe("CONSECUTIVE_SEAT_HELD");
    const activeWorkflows = await jsonRequest(
      page,
      `/api/admin/events/${eventA}/qr?workflows=active`,
    );
    const active = activeWorkflows.body.workflows as Array<{ id: string; claimedAt: string }>;
    const secondWorkflow = [...active].sort(
      (a, b) => Date.parse(b.claimedAt) - Date.parse(a.claimedAt),
    )[0];
    expect(secondWorkflow).toBeDefined();
    const cancelled = await jsonRequest(
      page,
      `/api/admin/events/${eventA}/qr?workflowId=${required(secondWorkflow?.id, "second workflow id")}`,
      "DELETE",
    );
    expect(cancelled.response.status).toBe(200);

    await workflowA.goto(`/e/${codes.consecutiveA}`);
    await expect(workflowA.getByRole("button", { name: /确定，开始抽奖/ })).toBeVisible();
    await workflowA.getByRole("button", { name: /确定，开始抽奖/ }).click();
    const workflowLottery = workflowA.getByRole("dialog");
    await expect(workflowLottery.getByRole("button", { name: "关闭" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(workflowLottery.getByText("连续首场", { exact: true })).toBeVisible();
    await expect(workflowLottery.getByText("连续后场", { exact: true })).toBeVisible();
    await workflowLottery.getByRole("button", { name: "关闭" }).click();
    await expect(workflowA.getByRole("heading", { name: "选座结果" })).toBeVisible();
    await expect(workflowA.getByText(seatDisplayName("B2"), { exact: true })).toHaveCount(2);
    await expect(workflowA.getByText("连续首场", { exact: true })).toBeVisible();
    await expect(workflowA.getByText("连续后场", { exact: true })).toBeVisible();
    await workflowA.reload();
    await expect(workflowA.getByRole("heading", { name: "选座结果" })).toBeVisible();
    await expect(workflowA.getByText(seatDisplayName("B2"), { exact: true })).toHaveCount(2);
    const finalizeAgain = await participantApi(workflowA, codes.consecutiveA, "workflow/finalize");
    expect(finalizeAgain.response.status).toBe(200);
    await withLocalTestDb(
      {
        port: loadLocalTestConfig().dbPort,
        password: loadLocalTestConfig().databasePassword,
        target: "e2e",
      },
      async (db) => {
        expect(
          await db.select().from(reservations).where(eq(reservations.eventId, eventA)),
        ).toHaveLength(1);
        expect(
          await db.select().from(reservations).where(eq(reservations.eventId, eventB)),
        ).toHaveLength(1);
        expect(
          await db.select().from(lotteryDraws).where(eq(lotteryDraws.eventId, eventA)),
        ).toHaveLength(1);
        expect(
          await db.select().from(lotteryDraws).where(eq(lotteryDraws.eventId, eventB)),
        ).toHaveLength(1);
        expect(await db.select().from(consecutiveCheckinSeatHolds)).toHaveLength(0);
        expect(
          await db
            .select()
            .from(consecutiveCheckinWorkflows)
            .where(eq(consecutiveCheckinWorkflows.status, "completed")),
        ).toHaveLength(1);
      },
    );

    // 9. Draft/ended events cannot issue or redeem; ended historical seating remains queryable.
    for (const code of [codes.draft, codes.ended]) {
      const id = required(eventIds[code], `${code} event`);
      const qrResponse = await jsonRequest(page, `/api/admin/events/${id}/qr`);
      expect(qrResponse.response.status).toBe(404);
      expect(qrResponse.body.error).toBe("NOT_FOUND");
      await page.goto(`/e/${code}`);
      await expect(page.getByRole("heading", { name: "找不到这个页面" })).toBeVisible();
    }
    const endedEventId = required(eventIds[codes.ended], "ended event");
    await page.goto(`/admin/events/${endedEventId}/participants`);
    const historicalRow = page.getByRole("row").filter({ hasText: "测试已选一" });
    await expect(historicalRow).toContainText(seatDisplayName("A2"));
    const endedReservations = await withLocalTestDb(
      {
        port: loadLocalTestConfig().dbPort,
        password: loadLocalTestConfig().databasePassword,
        target: "e2e",
      },
      async (db) => db.select().from(reservations).where(eq(reservations.eventId, endedEventId)),
    );
    expect(endedReservations).toHaveLength(1);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

import { and, eq, inArray, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { SEEDED_DATABASE_MARKER } from "./local-test-database";
import { eventInputSchema } from "@/features/events/schemas";
import { hallLayoutSchema } from "@/features/venues/schemas";
import { parseParticipantInput, validateResolvable } from "@/features/participants/import";
import { consecutiveTargetViolation } from "@/server/domain/consecutive-checkin-config";
import { effectiveEventAvailability } from "@/server/domain/event-seat-availability";
import * as schema from "./schema";
import {
  cinemas,
  consecutiveCheckinLinks,
  eventAuditLogs,
  eventSeats,
  events,
  halls,
  locationPresets,
  lotteryPrizes,
  participantTickets,
  participants,
  reservationSeats,
  reservations,
  seats,
  ticketTypes,
} from "./schema";
import { formatLocalDateTime, localDateTimeToDate } from "@/shared/date-time";

export type LocalTestFixtureManifest = {
  eventIds: Record<string, string>;
  ticketTypeIds: Record<string, Record<string, string>>;
  seatIds: Record<string, string>;
  participantIds: Record<string, Record<string, string>>;
};

type LocalTestDb = NodePgDatabase<typeof schema>;
type TicketSpec = { name: string; lotteryEligible: boolean };
type ParticipantSpec = {
  nickname: string;
  phone: string;
  ordinary: number;
  student: number;
};
type EventSpec = {
  code: string;
  name: string;
  status: "draft" | "open" | "ended";
  mode: "onsite" | "preregistered";
  location: "general" | "phone";
  locationCheck?: boolean;
  lottery?: boolean;
  lockedHalf?: "left" | "right";
  time?: "14:00" | "16:00";
  expectedLotteryTickets?: number;
  tickets: TicketSpec[];
  prizes?: Array<{ name: string; quantity: number }>;
  participantKind: "base" | "first-six" | "lottery-six" | "none" | "ended-seat";
  availableSeats: "standard" | "base";
};

const ordinaryStudent: TicketSpec[] = [
  { name: "普通票", lotteryEligible: false },
  { name: "学生票", lotteryEligible: false },
];
const ordinaryOnly: TicketSpec[] = [{ name: "普通票", lotteryEligible: false }];
const lotteryTickets: TicketSpec[] = [
  { name: "抽奖票", lotteryEligible: true },
  { name: "普通票", lotteryEligible: false },
];
const consecutiveTickets: TicketSpec[] = [
  { name: "抽奖票", lotteryEligible: true },
  { name: "普通票", lotteryEligible: false },
];

const roster: ParticipantSpec[] = [
  { nickname: "测试单人", phone: "9001", ordinary: 1, student: 0 },
  { nickname: "测试双人", phone: "9002", ordinary: 1, student: 1 },
  { nickname: "测试三人", phone: "9003", ordinary: 2, student: 1 },
  { nickname: "测试豁免", phone: "9004", ordinary: 1, student: 0 },
  { nickname: "测试已选一", phone: "9005", ordinary: 1, student: 0 },
  { nickname: "测试已选二", phone: "9006", ordinary: 2, student: 0 },
  { nickname: "碰撞完整甲", phone: "00000008001", ordinary: 1, student: 0 },
  { nickname: "碰撞完整乙", phone: "00000018001", ordinary: 1, student: 0 },
  { nickname: "碰撞尾号", phone: "8001", ordinary: 1, student: 0 },
  { nickname: "候选尾号甲", phone: "8002", ordinary: 1, student: 0 },
  { nickname: "候选尾号乙", phone: "8002", ordinary: 1, student: 0 },
  { nickname: "测试混合票", phone: "9007", ordinary: 1, student: 2 },
];

const eventSpecs: EventSpec[] = [
  {
    code: "local-preregistered",
    name: "预登记基础",
    status: "open",
    mode: "preregistered",
    location: "general",
    tickets: ordinaryStudent,
    participantKind: "base",
    availableSeats: "base",
  },
  {
    code: "local-onsite-single",
    name: "现场发票",
    status: "open",
    mode: "onsite",
    location: "general",
    tickets: ordinaryStudent,
    participantKind: "none",
    availableSeats: "standard",
  },
  {
    code: "local-location-check",
    name: "定位验证",
    status: "open",
    mode: "preregistered",
    location: "phone",
    locationCheck: true,
    tickets: ordinaryOnly,
    participantKind: "first-six",
    availableSeats: "standard",
  },
  {
    code: "local-lottery-demo",
    name: "抽奖验证",
    status: "open",
    mode: "preregistered",
    location: "general",
    lottery: true,
    tickets: lotteryTickets,
    prizes: [
      { name: "合成一等奖", quantity: 1 },
      { name: "合成纪念奖", quantity: 2 },
    ],
    participantKind: "lottery-six",
    availableSeats: "standard",
  },
  {
    code: "local-consecutive-a",
    name: "连续首场",
    status: "open",
    mode: "onsite",
    location: "general",
    lottery: true,
    expectedLotteryTickets: 10,
    tickets: consecutiveTickets,
    prizes: [{ name: "合成连场奖", quantity: 1 }],
    participantKind: "none",
    availableSeats: "standard",
  },
  {
    code: "local-consecutive-b",
    name: "连续后场",
    status: "open",
    mode: "onsite",
    location: "general",
    lottery: true,
    expectedLotteryTickets: 10,
    tickets: consecutiveTickets,
    prizes: [{ name: "合成连场奖", quantity: 1 }],
    participantKind: "none",
    availableSeats: "standard",
    time: "16:00",
  },
  {
    code: "local-half-left-lock",
    name: "左半区锁定",
    status: "open",
    mode: "preregistered",
    location: "general",
    lockedHalf: "left",
    tickets: ordinaryOnly,
    participantKind: "first-six",
    availableSeats: "standard",
  },
  {
    code: "local-half-right-lock",
    name: "右半区锁定",
    status: "open",
    mode: "preregistered",
    location: "general",
    lockedHalf: "right",
    tickets: ordinaryOnly,
    participantKind: "first-six",
    availableSeats: "standard",
  },
  {
    code: "local-draft-status",
    name: "草稿状态",
    status: "draft",
    mode: "preregistered",
    location: "general",
    tickets: ordinaryOnly,
    participantKind: "first-six",
    availableSeats: "standard",
  },
  {
    code: "local-ended-status",
    name: "结束状态",
    status: "ended",
    mode: "preregistered",
    location: "general",
    tickets: ordinaryOnly,
    participantKind: "ended-seat",
    availableSeats: "standard",
  },
];

function seatKey(rowLabel: string, columnLabel: string): string {
  return `${rowLabel}${columnLabel}`;
}

function assertValidDate(value: Date | null, code: string, time: string): Date {
  if (!value) throw new Error(`Invalid local-test start time for ${code}: ${time}`);
  return value;
}

function participantSelection(spec: ParticipantSpec, event: EventSpec): Record<string, number> {
  if (event.participantKind === "base") {
    return { 普通票: spec.ordinary, 学生票: spec.student };
  }
  const totalTickets = spec.ordinary + spec.student;
  if (event.participantKind === "lottery-six") {
    const lotteryEligible = ["9001", "9002", "9003", "9005", "9006"].includes(spec.phone);
    return {
      抽奖票: lotteryEligible ? totalTickets : 0,
      普通票: lotteryEligible ? 0 : totalTickets,
    };
  }
  return { 普通票: totalTickets };
}

function validateParticipant(
  spec: ParticipantSpec,
  event: EventSpec,
  eventTicketTypes: Array<typeof ticketTypes.$inferSelect>,
) {
  const quantities = participantSelection(spec, event);
  const ticketsByName = new Map(eventTicketTypes.map((ticket) => [ticket.name, ticket]));
  const ticketTypesForParser = eventTicketTypes.map((ticket) => ({
    id: ticket.id,
    name: ticket.name,
    lotteryEligible: ticket.lotteryEligible,
  }));
  const values = Object.fromEntries(
    Object.entries(quantities).flatMap(([name, quantity]) => {
      const ticket = ticketsByName.get(name);
      return ticket ? [[ticket.id, quantity]] : [];
    }),
  );
  return parseParticipantInput(
    { nickname: spec.nickname, phone: spec.phone, quantities: values },
    ticketTypesForParser,
  );
}

export async function readLocalTestFixtureManifest(
  db: LocalTestDb,
): Promise<LocalTestFixtureManifest> {
  const manifest: LocalTestFixtureManifest = {
    eventIds: {},
    ticketTypeIds: {},
    seatIds: {},
    participantIds: {},
  };
  const eventRows = await db.select().from(events).orderBy(events.publicCode);
  const codesById = new Map(eventRows.map((event) => [event.id, event.publicCode]));
  for (const event of eventRows) manifest.eventIds[event.publicCode] = event.id;

  if (eventRows.length) {
    const eventIds = eventRows.map((event) => event.id);
    const ticketRows = await db
      .select()
      .from(ticketTypes)
      .where(inArray(ticketTypes.eventId, eventIds))
      .orderBy(ticketTypes.sortOrder, ticketTypes.name);
    for (const ticket of ticketRows) {
      const code = codesById.get(ticket.eventId);
      if (!code) continue;
      (manifest.ticketTypeIds[code] ??= {})[ticket.name] = ticket.id;
    }
    const participantRows = await db
      .select()
      .from(participants)
      .where(inArray(participants.eventId, eventIds))
      .orderBy(participants.nickname, participants.id);
    for (const participant of participantRows) {
      const code = codesById.get(participant.eventId);
      if (!code) continue;
      (manifest.participantIds[code] ??= {})[participant.nickname] = participant.id;
    }
  }
  const hallIds = [
    ...new Set([
      ...eventRows.map((event) => event.hallId),
      ...(
        await db.select({ id: halls.id }).from(halls).where(eq(halls.name, "合成 60 座影厅"))
      ).map((hall) => hall.id),
    ]),
  ];
  if (hallIds.length) {
    const seatRows = await db
      .select()
      .from(seats)
      .where(and(inArray(seats.hallId, hallIds), eq(seats.kind, "seat")));
    for (const seat of seatRows)
      manifest.seatIds[seatKey(seat.rowLabel, seat.columnLabel)] = seat.id;
  }
  return manifest;
}

export async function seedLocalTestData(
  db: LocalTestDb,
  options: { now: Date },
): Promise<LocalTestFixtureManifest> {
  if (!Number.isFinite(options.now.getTime())) throw new Error("Seed time must be a valid Date");

  await db.transaction(async (tx) => {
    const date = formatLocalDateTime(options.now, "Asia/Shanghai").date;
    const cinema = (await tx.insert(cinemas).values({ name: "本地测试影院" }).returning())[0];
    if (!cinema) throw new Error("Failed to create local-test cinema");

    const cells = hallLayoutSchema.parse({
      rows: 6,
      columns: 12,
      centerAfterColumn: 5,
      cells: Array.from({ length: 6 }, (_, rowIndex) =>
        Array.from({ length: 12 }, (_, columnIndex) => {
          const rowLabel = String.fromCharCode(65 + rowIndex);
          if (columnIndex === 5)
            return {
              rowIndex,
              columnIndex,
              rowLabel,
              columnLabel: "",
              kind: "aisle" as const,
              selectable: false,
              golden: false,
            };
          if (columnIndex === 11)
            return {
              rowIndex,
              columnIndex,
              rowLabel,
              columnLabel: "",
              kind: "empty" as const,
              selectable: false,
              golden: false,
            };
          const seatNumber = columnIndex < 5 ? columnIndex + 1 : columnIndex;
          return {
            rowIndex,
            columnIndex,
            rowLabel,
            columnLabel: String(seatNumber),
            kind: "seat" as const,
            selectable: !(rowIndex === 0 && seatNumber === 1),
            golden: (rowIndex === 2 || rowIndex === 3) && seatNumber >= 4 && seatNumber <= 7,
          };
        }),
      ).flat(),
    });
    const hall = (
      await tx
        .insert(halls)
        .values({
          cinemaId: cinema.id,
          name: "合成 60 座影厅",
          centerAfterColumn: cells.centerAfterColumn,
        })
        .returning()
    )[0];
    if (!hall) throw new Error("Failed to create local-test hall");
    const insertedSeats = await tx
      .insert(seats)
      .values(
        cells.cells.map((cell) => ({
          hallId: hall.id,
          rowIndex: cell.rowIndex,
          columnIndex: cell.columnIndex,
          rowLabel: cell.rowLabel,
          columnLabel: cell.columnLabel,
          kind: cell.kind,
          selectable: cell.selectable,
          golden: cell.golden,
        })),
      )
      .returning();
    const actualSeats = insertedSeats.filter((seat) => seat.kind === "seat");
    const seatIdByKey = new Map(
      actualSeats.map((seat) => [seatKey(seat.rowLabel, seat.columnLabel), seat.id]),
    );
    if (actualSeats.length !== 60 || seatIdByKey.size !== 60)
      throw new Error("Local-test hall must contain exactly 60 seats");

    const generalLocation = (
      await tx
        .insert(locationPresets)
        .values({ name: "合成通用地点", latitude: 0, longitude: 0, defaultRadiusMeters: 500 })
        .returning()
    )[0];
    const phoneLocation = (
      await tx
        .insert(locationPresets)
        .values({ name: "手机定位测试地点", latitude: 0, longitude: 0, defaultRadiusMeters: 500 })
        .returning()
    )[0];
    if (!generalLocation || !phoneLocation)
      throw new Error("Failed to create local-test locations");

    const eventRows: Array<typeof events.$inferSelect> = [];
    const eventTicketRows = new Map<string, Array<typeof ticketTypes.$inferSelect>>();
    const allSeats = insertedSeats.map((seat) => ({
      id: seat.id,
      kind: seat.kind,
      templateSelectable: seat.selectable,
      rowIndex: seat.rowIndex,
      columnIndex: seat.columnIndex,
    }));
    const standardSeatIds = insertedSeats
      .filter((seat) => seat.kind === "seat" && seat.selectable)
      .map((seat) => seat.id);
    for (const spec of eventSpecs) {
      const startTime = spec.time ?? "14:00";
      const parsed = eventInputSchema.parse({
        hallId: hall.id,
        availableSeatIds: standardSeatIds,
        name: spec.name,
        locationId: spec.location === "phone" ? phoneLocation.id : generalLocation.id,
        radiusMeters: 500,
        startDate: date,
        startTime,
        timeZone: "Asia/Shanghai",
        locationCheckEnabled: spec.locationCheck ?? false,
        lotteryEnabled: spec.lottery ?? false,
        participationMode: spec.mode,
        maxTicketsPerIssue: 7,
        expectedLotteryTickets: spec.expectedLotteryTickets,
        lotteryPoolBonus: 0,
        ticketTypes: spec.tickets,
        prizes: spec.prizes ?? [],
      });
      const insertedEvent = (
        await tx
          .insert(events)
          .values({
            publicCode: spec.code,
            name: parsed.name,
            hallId: parsed.hallId,
            locationId: parsed.locationId,
            radiusMeters: parsed.radiusMeters,
            status: spec.status,
            version: 1,
            startsAt: assertValidDate(
              localDateTimeToDate(parsed.startDate, parsed.startTime, parsed.timeZone),
              spec.code,
              startTime,
            ),
            timeZone: parsed.timeZone,
            locationCheckEnabled: parsed.locationCheckEnabled,
            lotteryEnabled: parsed.lotteryEnabled,
            participationMode: parsed.participationMode,
            maxTicketsPerIssue: parsed.maxTicketsPerIssue,
            expectedLotteryTickets: parsed.expectedLotteryTickets ?? null,
            lotteryPoolBonus: parsed.lotteryPoolBonus,
            lockedSeatHalf: spec.lockedHalf ?? null,
            qrTokenNonce: null,
            qrTokenHash: null,
            qrTokenIssuedAt: null,
            qrTokenExpiresAt: null,
          })
          .returning()
      )[0];
      if (!insertedEvent) throw new Error(`Failed to create event ${spec.code}`);
      eventRows.push(insertedEvent);
      const insertedTickets = await tx
        .insert(ticketTypes)
        .values(
          parsed.ticketTypes.map((ticket, sortOrder) => ({
            eventId: insertedEvent.id,
            name: ticket.name,
            lotteryEligible: ticket.lotteryEligible,
            sortOrder,
          })),
        )
        .returning();
      eventTicketRows.set(spec.code, insertedTickets);
      if (parsed.prizes.length) {
        await tx.insert(lotteryPrizes).values(
          parsed.prizes.map((prize, sortOrder) => ({
            eventId: insertedEvent.id,
            name: prize.name,
            quantity: prize.quantity,
            sortOrder,
          })),
        );
      }
      const seatById = new Map(insertedSeats.map((seat) => [seat.id, seat]));
      let availableSeatIds = standardSeatIds;
      if (spec.availableSeats === "base") {
        availableSeatIds = standardSeatIds.filter((id) => {
          const seat = seatById.get(id);
          return seat && !(seat.rowLabel === "B" && seat.columnLabel === "10");
        });
      }
      const effectiveSeatIds = effectiveEventAvailability(
        allSeats,
        availableSeatIds,
        spec.lockedHalf ?? null,
        cells.centerAfterColumn,
      );
      if (spec.lockedHalf === "left" && effectiveSeatIds.length !== 30)
        throw new Error("Left-half lock must leave 30 seats available");
      if (spec.lockedHalf === "right" && effectiveSeatIds.length !== 29)
        throw new Error("Right-half lock must leave 29 seats available");
      if (availableSeatIds.length)
        await tx
          .insert(eventSeats)
          .values(availableSeatIds.map((seatId) => ({ eventId: insertedEvent.id, seatId })));
    }

    const eventByCode = new Map(eventRows.map((event) => [event.publicCode, event]));
    const consecutiveSource = eventByCode.get("local-consecutive-a");
    const consecutiveTarget = eventByCode.get("local-consecutive-b");
    if (!consecutiveSource || !consecutiveTarget)
      throw new Error("Consecutive fixture events are missing");
    const violation = consecutiveTargetViolation(consecutiveSource, consecutiveTarget);
    if (violation) throw new Error(`Invalid consecutive fixture configuration: ${violation}`);
    await tx
      .insert(consecutiveCheckinLinks)
      .values({ sourceEventId: consecutiveSource.id, targetEventId: consecutiveTarget.id });

    const participantIds = new Map<string, Map<string, string>>();
    for (const spec of eventSpecs) {
      const event = eventByCode.get(spec.code);
      const eventTicketTypes = eventTicketRows.get(spec.code) ?? [];
      if (!event) throw new Error(`Missing fixture event ${spec.code}`);
      let selectedPeople: ParticipantSpec[] = [];
      if (spec.participantKind === "base") selectedPeople = roster;
      if (spec.participantKind === "first-six") selectedPeople = roster.slice(0, 6);
      if (spec.participantKind === "lottery-six") selectedPeople = roster.slice(0, 6);
      if (spec.participantKind === "ended-seat") selectedPeople = roster.slice(0, 6);
      const parsedPeople = selectedPeople.map((person) =>
        validateParticipant(person, spec, eventTicketTypes),
      );
      validateResolvable(parsedPeople);
      for (let index = 0; index < selectedPeople.length; index += 1) {
        const person = selectedPeople[index];
        const parsed = parsedPeople[index];
        if (!person || !parsed) continue;
        const participant = (
          await tx
            .insert(participants)
            .values({
              eventId: event.id,
              nickname: parsed.nickname,
              nicknameFirst: parsed.nicknameFirst,
              phoneDigits: parsed.phoneDigits,
              phoneLast4: parsed.phoneLast4,
              phoneIsFull: parsed.phoneIsFull,
              ticketTotal: parsed.ticketTotal,
              source: "preregistered",
              issueNumber: null,
              deviceHash: null,
              deviceBoundAt: null,
              locationExemptAt:
                spec.code === "local-location-check" && person.phone === "9004"
                  ? options.now
                  : null,
              createdAt: options.now,
            })
            .returning()
        )[0];
        if (!participant) throw new Error(`Failed to insert participant ${person.nickname}`);
        let eventParticipantIds = participantIds.get(spec.code);
        if (!eventParticipantIds) {
          eventParticipantIds = new Map<string, string>();
          participantIds.set(spec.code, eventParticipantIds);
        }
        eventParticipantIds.set(person.nickname, participant.id);
        const rows = parsed.tickets.map((ticket) => ({
          participantId: participant.id,
          ticketTypeId: ticket.ticketTypeId,
          quantity: ticket.quantity,
        }));
        if (rows.length) await tx.insert(participantTickets).values(rows);
      }
    }

    const occupied = [
      { code: "local-preregistered", nickname: "测试已选一", seats: ["A2"] },
      { code: "local-preregistered", nickname: "测试已选二", seats: ["A3", "A4"] },
      { code: "local-ended-status", nickname: "测试已选一", seats: ["A2"] },
    ];
    const occupiedSeatKeys = new Set<string>();
    for (const [reservationIndex, item] of occupied.entries()) {
      const event = eventByCode.get(item.code);
      const participantId = participantIds.get(item.code)?.get(item.nickname);
      const rosterPerson = roster.find((person) => person.nickname === item.nickname);
      if (!event || !participantId || !rosterPerson)
        throw new Error(`Missing static reservation participant ${item.nickname}`);
      const seatIdList = item.seats.map((key) => seatIdByKey.get(key));
      const validSeatIds = seatIdList.filter((id): id is string => id !== undefined);
      if (validSeatIds.length !== item.seats.length)
        throw new Error(`Missing seat for static reservation: ${item.seats.join(",")}`);
      if (validSeatIds.length > rosterPerson.ordinary + rosterPerson.student) {
        throw new Error(`Static reservation exceeds ticket count for ${item.nickname}`);
      }
      if (new Set(validSeatIds).size !== validSeatIds.length)
        throw new Error("Static reservation contains duplicate seats");
      const eventAvailableSeats = await tx
        .select({ seatId: eventSeats.seatId })
        .from(eventSeats)
        .where(eq(eventSeats.eventId, event.id));
      const availableSeatIds = new Set(eventAvailableSeats.map((row) => row.seatId));
      for (const seatId of validSeatIds) {
        const occupiedKey = `${event.id}:${seatId}`;
        if (!availableSeatIds.has(seatId) || occupiedSeatKeys.has(occupiedKey)) {
          throw new Error("Static reservation contains an unavailable or already occupied seat");
        }
        occupiedSeatKeys.add(occupiedKey);
      }
      await tx
        .update(events)
        .set({ version: sql`${events.version} + 1` })
        .where(eq(events.id, event.id));
      const reservation = (
        await tx
          .insert(reservations)
          .values({ eventId: event.id, participantId, confirmedAt: options.now })
          .returning()
      )[0];
      if (!reservation) throw new Error("Failed to create static reservation");
      await tx
        .insert(reservationSeats)
        .values(
          validSeatIds.map((seatId) => ({
            reservationId: reservation.id,
            eventId: event.id,
            seatId,
          })),
        );
      await tx.insert(eventAuditLogs).values({
        eventId: event.id,
        participantId,
        action: "seat_confirmed",
        occurredAt: new Date(options.now.getTime() + reservationIndex),
        details: { seatIds: validSeatIds, fixture: true },
      });
    }

    const currentDatabase = await tx.execute<{ current_database: string }>(
      sql`select current_database()`,
    );
    const databaseName = currentDatabase.rows[0]?.current_database;
    const markerSql =
      databaseName === "pickseat_local_test"
        ? `COMMENT ON DATABASE pickseat_local_test IS '${SEEDED_DATABASE_MARKER}'`
        : databaseName === "pickseat_local_test_e2e"
          ? `COMMENT ON DATABASE pickseat_local_test_e2e IS '${SEEDED_DATABASE_MARKER}'`
          : null;
    if (!markerSql) throw new Error("Refusing to seed an unrecognized local-test database");
    await tx.execute(sql.raw(markerSql));
  });

  return readLocalTestFixtureManifest(db);
}

import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const seatKind = pgEnum("seat_kind", ["seat", "aisle", "empty"]);
export const eventStatus = pgEnum("event_status", ["draft", "open", "ended"]);
export const eventParticipationMode = pgEnum("event_participation_mode", [
  "onsite",
  "preregistered",
]);
export const eventSeatHalf = pgEnum("event_seat_half", ["left", "right"]);
export const participantSource = pgEnum("participant_source", ["onsite", "preregistered"]);
export const auditLevel = pgEnum("audit_level", ["info", "warn", "error"]);
export const auditAction = pgEnum("audit_action", [
  "event_created",
  "event_configuration_changed",
  "event_status_changed",
  "seat_availability_changed",
  "participants_imported",
  "participant_added",
  "device_reset",
  "location_exemption_changed",
  "selection_reset",
  "seat_confirmed",
  "seat_conflict",
  "selection_displaced",
  "seating_entered",
  "location_verified",
  "location_rejected",
  "lottery_drawn",
  "identity_tail_choice_required",
  "ticket_issue_created",
  "ticket_issue_claimed",
  "ticket_issue_replaced",
]);

export const cinemas = pgTable("cinemas", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const halls = pgTable("halls", {
  id: uuid("id").primaryKey().defaultRandom(),
  cinemaId: uuid("cinema_id")
    .notNull()
    .references(() => cinemas.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  centerAfterColumn: integer("center_after_column"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const seats = pgTable(
  "seats",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    hallId: uuid("hall_id")
      .notNull()
      .references(() => halls.id, { onDelete: "cascade" }),
    rowIndex: integer("row_index").notNull(),
    columnIndex: integer("column_index").notNull(),
    rowLabel: text("row_label").notNull(),
    columnLabel: text("column_label").notNull(),
    kind: seatKind("kind").notNull().default("seat"),
    selectable: boolean("selectable").notNull().default(true),
    golden: boolean("golden").notNull().default(false),
  },
  (table) => [
    uniqueIndex("seats_hall_position_uidx").on(table.hallId, table.rowIndex, table.columnIndex),
  ],
);

export const locationPresets = pgTable("location_presets", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  defaultRadiusMeters: integer("default_radius_meters").notNull().default(1000),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    publicCode: text("public_code").notNull().unique(),
    name: text("name").notNull(),
    hallId: uuid("hall_id")
      .notNull()
      .references(() => halls.id),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locationPresets.id),
    radiusMeters: integer("radius_meters").notNull(),
    status: eventStatus("status").notNull().default("draft"),
    version: integer("version").notNull().default(1),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    timeZone: text("time_zone").notNull().default("Asia/Shanghai"),
    locationCheckEnabled: boolean("location_check_enabled").notNull().default(true),
    lotteryEnabled: boolean("lottery_enabled").notNull().default(false),
    participationMode: eventParticipationMode("participation_mode").notNull().default("onsite"),
    maxTicketsPerIssue: integer("max_tickets_per_issue").notNull().default(7),
    expectedLotteryTickets: integer("expected_lottery_tickets"),
    nextIssueNumber: integer("next_issue_number").notNull().default(1),
    qrTokenNonce: text("qr_token_nonce"),
    qrTokenHash: text("qr_token_hash"),
    qrTokenIssuedAt: timestamp("qr_token_issued_at", { withTimezone: true }),
    qrTokenExpiresAt: timestamp("qr_token_expires_at", { withTimezone: true }),
    lotteryPoolBonus: integer("lottery_pool_bonus").notNull().default(0),
    lockedSeatHalf: eventSeatHalf("locked_seat_half"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("events_status_starts_at_idx").on(table.status, table.startsAt)],
);

export const ticketTypes = pgTable(
  "ticket_types",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull(),
    lotteryEligible: boolean("lottery_eligible").notNull().default(false),
  },
  (table) => [uniqueIndex("ticket_types_event_name_uidx").on(table.eventId, table.name)],
);

export const lotteryPrizes = pgTable(
  "lottery_prizes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    quantity: integer("quantity").notNull(),
    sortOrder: integer("sort_order").notNull(),
  },
  (table) => [uniqueIndex("lottery_prizes_event_name_uidx").on(table.eventId, table.name)],
);

export const participants = pgTable(
  "participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    nickname: text("nickname").notNull(),
    nicknameFirst: text("nickname_first").notNull(),
    phoneDigits: text("phone_digits").notNull(),
    phoneLast4: text("phone_last4").notNull(),
    phoneIsFull: boolean("phone_is_full").notNull(),
    ticketTotal: integer("ticket_total").notNull(),
    source: participantSource("source").notNull().default("preregistered"),
    issueNumber: integer("issue_number"),
    deviceHash: text("device_hash"),
    deviceBoundAt: timestamp("device_bound_at", { withTimezone: true }),
    locationExemptAt: timestamp("location_exempt_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("participants_event_last4_idx").on(table.eventId, table.phoneLast4),
    index("participants_device_hash_idx")
      .on(table.deviceHash)
      .where(sql`${table.deviceHash} is not null`),
    uniqueIndex("participants_event_issue_number_uidx")
      .on(table.eventId, table.issueNumber)
      .where(sql`${table.issueNumber} is not null`),
  ],
);

export type TicketIssueAllocation = { ticketTypeId: string; quantity: number };

export const ticketIssues = pgTable(
  "ticket_issues",
  {
    id: uuid("id").primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    tokenNonce: text("token_nonce").notNull(),
    tokenHash: text("token_hash").notNull(),
    allocation: jsonb("allocation").$type<TicketIssueAllocation[]>().notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true, precision: 3 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, precision: 3 }).notNull(),
    invalidatedAt: timestamp("invalidated_at", { withTimezone: true, precision: 3 }),
    consumedAt: timestamp("consumed_at", { withTimezone: true, precision: 3 }),
    participantId: uuid("participant_id").references(() => participants.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    uniqueIndex("ticket_issues_token_hash_uidx").on(table.tokenHash),
    index("ticket_issues_event_issued_idx").on(table.eventId, table.issuedAt),
    index("ticket_issues_participant_idx").on(table.participantId),
  ],
);

export const lotteryDraws = pgTable(
  "lottery_draws",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    drawIndex: integer("draw_index").notNull(),
    prizeId: uuid("prize_id").references(() => lotteryPrizes.id),
    prizeName: text("prize_name"),
    drawnAt: timestamp("drawn_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("lottery_draws_participant_index_uidx").on(table.participantId, table.drawIndex),
    index("lottery_draws_event_idx").on(table.eventId),
    index("lottery_draws_prize_idx").on(table.prizeId),
  ],
);

export const participantTickets = pgTable(
  "participant_tickets",
  {
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    ticketTypeId: uuid("ticket_type_id")
      .notNull()
      .references(() => ticketTypes.id),
    quantity: integer("quantity").notNull(),
  },
  (table) => [
    uniqueIndex("participant_tickets_participant_type_uidx").on(
      table.participantId,
      table.ticketTypeId,
    ),
  ],
);

export const eventAuditLogs = pgTable(
  "event_audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    participantId: uuid("participant_id").references(() => participants.id, {
      onDelete: "set null",
    }),
    action: auditAction("action").notNull(),
    level: auditLevel("level").notNull().default("info"),
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
    occurredAt: timestamp("occurred_at", { withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("event_audit_logs_event_time_idx").on(table.eventId, table.occurredAt),
    index("event_audit_logs_participant_idx").on(table.participantId),
  ],
);

export const reservations = pgTable(
  "reservations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("reservations_event_participant_uidx").on(table.eventId, table.participantId),
  ],
);

export const eventSeats = pgTable(
  "event_seats",
  {
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    seatId: uuid("seat_id")
      .notNull()
      .references(() => seats.id),
  },
  (table) => [
    uniqueIndex("event_seats_event_seat_uidx").on(table.eventId, table.seatId),
    index("event_seats_event_idx").on(table.eventId),
  ],
);

export const reservationSeats = pgTable(
  "reservation_seats",
  {
    reservationId: uuid("reservation_id")
      .notNull()
      .references(() => reservations.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    seatId: uuid("seat_id")
      .notNull()
      .references(() => seats.id),
  },
  (table) => [
    uniqueIndex("reservation_seats_event_seat_uidx").on(table.eventId, table.seatId),
    index("reservation_seats_reservation_idx").on(table.reservationId),
  ],
);

export const adminSessions = pgTable(
  "admin_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: text("token_hash").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("admin_sessions_expires_at_idx").on(table.expiresAt)],
);

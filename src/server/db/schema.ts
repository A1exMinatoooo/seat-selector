import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const seatKind = pgEnum("seat_kind", ["seat", "aisle", "empty"]);
export const eventStatus = pgEnum("event_status", ["draft", "open", "ended"]);

export const cinemas = pgTable("cinemas", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const halls = pgTable("halls", {
  id: uuid("id").primaryKey().defaultRandom(),
  cinemaId: uuid("cinema_id").notNull().references(() => cinemas.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  centerAfterColumn: integer("center_after_column"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const seats = pgTable(
  "seats",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    hallId: uuid("hall_id").notNull().references(() => halls.id, { onDelete: "cascade" }),
    rowIndex: integer("row_index").notNull(),
    columnIndex: integer("column_index").notNull(),
    rowLabel: text("row_label").notNull(),
    columnLabel: text("column_label").notNull(),
    kind: seatKind("kind").notNull().default("seat"),
    selectable: boolean("selectable").notNull().default(true),
    golden: boolean("golden").notNull().default(false),
  },
  (table) => [uniqueIndex("seats_hall_position_uidx").on(table.hallId, table.rowIndex, table.columnIndex)],
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
    hallId: uuid("hall_id").notNull().references(() => halls.id),
    locationId: uuid("location_id").notNull().references(() => locationPresets.id),
    radiusMeters: integer("radius_meters").notNull(),
    status: eventStatus("status").notNull().default("draft"),
    version: integer("version").notNull().default(1),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    timeZone: text("time_zone").notNull().default("Asia/Shanghai"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("events_status_starts_at_idx").on(table.status, table.startsAt)],
);

export const ticketTypes = pgTable(
  "ticket_types",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull(),
  },
  (table) => [uniqueIndex("ticket_types_event_name_uidx").on(table.eventId, table.name)],
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

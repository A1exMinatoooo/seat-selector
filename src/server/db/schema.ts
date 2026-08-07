import {
  boolean,
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

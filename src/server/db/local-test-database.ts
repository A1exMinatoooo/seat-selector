import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { Pool, type PoolClient } from "pg";
import { z } from "zod";
import * as schema from "./schema";

export const PREPARED_DATABASE_MARKER = "pick-your-seat:local-test:v1:prepared";
export const SEEDED_DATABASE_MARKER = "pick-your-seat:local-test:v1:seeded";

const databaseNames = {
  manual: "pickseat_local_test",
  e2e: "pickseat_local_test_e2e",
} as const;

const inputSchema = z
  .object({
    port: z.number().int().min(1).max(65_535),
    password: z.string().min(1),
    target: z.enum(["manual", "e2e"]),
  })
  .strict();

const prepareInputSchema = inputSchema.extend({ reset: z.boolean() }).strict();

type Marker = typeof PREPARED_DATABASE_MARKER | typeof SEEDED_DATABASE_MARKER;

function createPool(port: number, password: string, database: string): Pool {
  return new Pool({
    host: "127.0.0.1",
    port,
    user: "pickseat_local_test",
    password,
    database,
    max: 4,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 10_000,
    ssl: false,
  });
}

function markerSql(name: string, marker: Marker): string {
  // Both values come exclusively from the constants above and the closed target map.
  return `COMMENT ON DATABASE ${name} IS '${marker}'`;
}

async function readDatabaseMarker(client: PoolClient, name: string): Promise<string | null> {
  const result = await client.query<{ marker: string | null }>(
    "SELECT shobj_description(oid, 'pg_database') AS marker FROM pg_database WHERE datname = $1",
    [name],
  );
  return result.rows[0]?.marker ?? null;
}

async function databaseExists(client: PoolClient, name: string): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1) AS exists",
    [name],
  );
  return result.rows[0]?.exists ?? false;
}
async function ensureOnlyLocalTestDatabasesExist(client: PoolClient): Promise<void> {
  const result = await client.query<{ datname: string; marker: string | null }>(
    "SELECT datname, shobj_description(oid, 'pg_database') AS marker FROM pg_database WHERE NOT datistemplate AND datname <> 'postgres'",
  );
  for (const row of result.rows) {
    if (row.datname !== databaseNames.manual && row.datname !== databaseNames.e2e) {
      throw new Error(
        "Refusing to create a local-test database in an instance with an unexpected database.",
      );
    }
    if (row.marker !== PREPARED_DATABASE_MARKER && row.marker !== SEEDED_DATABASE_MARKER) {
      throw new Error("Refusing to create a local-test database beside an unmarked database.");
    }
  }
}

async function ensureEmptyDatabase(client: PoolClient): Promise<void> {
  const publicTables = await client.query<{ tablename: string }>(
    "SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'",
  );
  const businessTables = publicTables.rows
    .map(({ tablename }) => tablename)
    .filter((tablename) => tablename !== "__drizzle_migrations");
  if (businessTables.length > 0) {
    throw new Error("Refusing to take over a local-test database containing public tables.");
  }

  const migrationTables = await client.query<{ schemaname: string }>(
    "SELECT schemaname FROM pg_catalog.pg_tables WHERE tablename = '__drizzle_migrations' AND schemaname IN ('drizzle', 'public')",
  );
  for (const { schemaname } of migrationTables.rows) {
    const table =
      schemaname === "drizzle"
        ? '"drizzle"."__drizzle_migrations"'
        : '"public"."__drizzle_migrations"';
    const migrationRows = await client.query(`SELECT EXISTS (SELECT 1 FROM ${table}) AS has_rows`);
    if (migrationRows.rows[0]?.has_rows === true) {
      throw new Error("Refusing to take over a local-test database containing migration records.");
    }
  }
}

async function setDatabaseMarker(
  adminClient: PoolClient,
  name: string,
  marker: Marker,
): Promise<void> {
  await adminClient.query(markerSql(name, marker));
}

async function recreateDatabase(adminClient: PoolClient, name: string): Promise<void> {
  await adminClient.query(`DROP DATABASE ${name} WITH (FORCE)`);
  await adminClient.query(`CREATE DATABASE ${name} OWNER pickseat_local_test`);
  await setDatabaseMarker(adminClient, name, PREPARED_DATABASE_MARKER);
}

/**
 * Initializes the selected database marker, or safely recreates only a previously
 * marked local-test database when reset is explicitly requested.
 */
export async function prepareLocalTestDatabase(input: {
  port: number;
  password: string;
  target: "manual" | "e2e";
  reset: boolean;
}): Promise<"prepared" | "seeded"> {
  const parsed = prepareInputSchema.parse(input);
  const name = databaseNames[parsed.target];
  const adminPool = createPool(parsed.port, parsed.password, "postgres");
  try {
    const adminClient = await adminPool.connect();
    try {
      const exists = await databaseExists(adminClient, name);
      if (parsed.reset) {
        if (!exists) {
          throw new Error("Refusing to reset a local-test database that does not exist.");
        }
        const marker = await readDatabaseMarker(adminClient, name);
        if (marker !== PREPARED_DATABASE_MARKER && marker !== SEEDED_DATABASE_MARKER) {
          throw new Error("Refusing to reset a database without a recognized local-test marker.");
        }
        await recreateDatabase(adminClient, name);
        return "prepared";
      }

      if (!exists) {
        await ensureOnlyLocalTestDatabasesExist(adminClient);
        await adminClient.query(`CREATE DATABASE ${name} OWNER pickseat_local_test`);
        await setDatabaseMarker(adminClient, name, PREPARED_DATABASE_MARKER);
        return "prepared";
      }

      const marker = await readDatabaseMarker(adminClient, name);
      if (marker === PREPARED_DATABASE_MARKER) return "prepared";
      if (marker === SEEDED_DATABASE_MARKER) return "seeded";
      if (marker !== null) {
        throw new Error("Refusing to use a database with an unknown local-test marker.");
      }

      const targetPool = createPool(parsed.port, parsed.password, name);
      try {
        const targetClient = await targetPool.connect();
        try {
          await ensureEmptyDatabase(targetClient);
          await setDatabaseMarker(adminClient, name, PREPARED_DATABASE_MARKER);
          return "prepared";
        } finally {
          targetClient.release();
        }
      } finally {
        await targetPool.end();
      }
    } finally {
      adminClient.release();
    }
  } finally {
    await adminPool.end();
  }
}

/** Runs work against the fixed loopback endpoint and database for a target. */
export async function withLocalTestDb<T>(
  input: { port: number; password: string; target: "manual" | "e2e" },
  run: (db: NodePgDatabase<typeof schema>) => Promise<T>,
): Promise<T> {
  const parsed = inputSchema.parse(input);
  const name = databaseNames[parsed.target];
  const pool = createPool(parsed.port, parsed.password, name);
  try {
    const client = await pool.connect();
    try {
      const marker = await readDatabaseMarker(client, name);
      if (marker !== PREPARED_DATABASE_MARKER && marker !== SEEDED_DATABASE_MARKER) {
        throw new Error("Refusing to access a database without a recognized local-test marker.");
      }
    } finally {
      client.release();
    }
    return await run(drizzle(pool, { schema }));
  } finally {
    await pool.end();
  }
}
export async function readLocalTestDatabaseInfo(db: NodePgDatabase<typeof schema>): Promise<
  Array<{
    publicCode: string;
    name: string;
    status: "draft" | "open" | "ended";
    version: number;
    participantCount: number;
    totalTickets: number;
    reservationCount: number;
    reservedSeats: number;
  }>
> {
  const result = await db.execute<{
    publicCode: string;
    name: string;
    status: "draft" | "open" | "ended";
    version: number;
    participantCount: number;
    totalTickets: number;
    reservationCount: number;
    reservedSeats: number;
  }>(sql`
    SELECT
      e.public_code AS "publicCode",
      e.name,
      e.status,
      e.version,
      COALESCE(p.participant_count, 0)::int AS "participantCount",
      COALESCE(p.total_tickets, 0)::int AS "totalTickets",
      COALESCE(r.reservation_count, 0)::int AS "reservationCount",
      COALESCE(rs.reserved_seats, 0)::int AS "reservedSeats"
    FROM events e
    LEFT JOIN (
      SELECT event_id, COUNT(*)::int AS participant_count, COALESCE(SUM(ticket_total), 0)::int AS total_tickets
      FROM participants
      GROUP BY event_id
    ) p ON p.event_id = e.id
    LEFT JOIN (
      SELECT event_id, COUNT(*)::int AS reservation_count
      FROM reservations
      GROUP BY event_id
    ) r ON r.event_id = e.id
    LEFT JOIN (
      SELECT event_id, COUNT(*)::int AS reserved_seats
      FROM reservation_seats
      GROUP BY event_id
    ) rs ON rs.event_id = e.id
    ORDER BY e.public_code
  `);
  return result.rows;
}

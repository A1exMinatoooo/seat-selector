import "server-only";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/server/env";
import * as schema from "./schema";

declare global {
  var __pickSeatPool: Pool | undefined;
}

function createPool(): Pool {
  const pool = new Pool({
    connectionString: env().DATABASE_URL,
    max: 12,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  pool.on("error", (error) => {
    const databaseError = error as Error & { code?: unknown };
    console.error(
      JSON.stringify({
        level: "error",
        message: "database_pool_error",
        code: typeof databaseError.code === "string" ? databaseError.code : undefined,
      }),
    );
  });

  return pool;
}

export function getPool(): Pool {
  globalThis.__pickSeatPool ??= createPool();
  return globalThis.__pickSeatPool;
}

export function getDb(): NodePgDatabase<typeof schema> {
  return drizzle(getPool(), { schema });
}

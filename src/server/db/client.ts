import "server-only";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/server/env";
import * as schema from "./schema";

declare global {
  var __pickSeatPool: Pool | undefined;
}

export function getPool(): Pool {
  globalThis.__pickSeatPool ??= new Pool({
    connectionString: env().DATABASE_URL,
    max: 12,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  return globalThis.__pickSeatPool;
}

export function getDb(): NodePgDatabase<typeof schema> {
  return drizzle(getPool(), { schema });
}

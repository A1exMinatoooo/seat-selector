import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { resolve } from "node:path";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  await migrate(drizzle(pool), { migrationsFolder: resolve("drizzle") });
  process.stdout.write("Database migrations completed.\n");
} finally {
  await pool.end();
}

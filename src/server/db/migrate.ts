import { migrate } from "drizzle-orm/node-postgres/migrator";
import { getDb, getPool } from "./client";

async function main() {
  await migrate(getDb(), { migrationsFolder: "drizzle" });
  await getPool().end();
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Migration failed"}\n`);
  process.exitCode = 1;
});

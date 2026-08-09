import { readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { describe, expect, it } from "vitest";

type MigrationJournal = {
  entries: Array<{ tag: string }>;
};

describe("migration journal", () => {
  it("registers every SQL migration exactly once", () => {
    const migrationsDirectory = join(process.cwd(), "drizzle");
    const sqlMigrationTags = readdirSync(migrationsDirectory)
      .filter((fileName) => fileName.endsWith(".sql"))
      .map((fileName) => basename(fileName, ".sql"))
      .sort();
    const journal = JSON.parse(
      readFileSync(join(migrationsDirectory, "meta", "_journal.json"), "utf8"),
    ) as MigrationJournal;

    expect(journal.entries.map((entry) => entry.tag).sort()).toEqual(sqlMigrationTags);
  });
});

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

  it("indexes non-null participant device hashes for daily record lookup", () => {
    const migration = readFileSync(
      join(process.cwd(), "drizzle", "0018_daily-seat-records.sql"),
      "utf8",
    );
    expect(migration).toContain('CREATE INDEX "participants_device_hash_idx"');
    expect(migration).toContain('WHERE "participants"."device_hash" is not null');
  });

  it("renames participant identity columns without replacing stored nicknames", () => {
    const migration = readFileSync(
      join(process.cwd(), "drizzle", "0020_bent_roxanne_simpson.sql"),
      "utf8",
    );
    expect(migration).toContain('RENAME COLUMN "name" TO "nickname"');
    expect(migration).toContain('RENAME COLUMN "name_first" TO "nickname_first"');
    expect(migration).not.toContain("DROP COLUMN");
  });

  it("changes only the default onsite issue limit", () => {
    const migration = readFileSync(
      join(process.cwd(), "drizzle", "0022_common_runaways.sql"),
      "utf8",
    );
    expect(migration).toContain('ALTER COLUMN "max_tickets_per_issue" SET DEFAULT 7');
    expect(migration).not.toContain("UPDATE");
  });
});

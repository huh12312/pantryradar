import { createHash } from "crypto";
import { readFileSync, existsSync } from "fs";
import type { Sql } from "postgres";

interface JournalEntry {
  idx: number;
  tag: string;
  when: number;
  breakpoints: boolean;
}

interface Journal {
  entries: JournalEntry[];
}

/**
 * Custom migration runner for Bun + postgres.js.
 *
 * Drizzle's built-in migrate() uses timestamp (bigint) comparison, which
 * breaks on Bun because Number(postgres_bigint) truncates to int32, making
 * every migration appear unrun. This runner compares by hash (a text column),
 * which roundtrips correctly through postgres.js on Bun.
 */
export async function runMigrations(sql: Sql, migrationsFolder: string): Promise<void> {
  const journalPath = `${migrationsFolder}/meta/_journal.json`;
  if (!existsSync(journalPath)) {
    throw new Error(`No migration journal found at ${journalPath}`);
  }

  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as Journal;

  // Ensure tracking schema/table exist
  await sql`CREATE SCHEMA IF NOT EXISTS drizzle`;
  await sql`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id   SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `;

  // Fetch already-applied hashes — compare by text, not by bigint timestamp
  const applied = await sql<{ hash: string }[]>`
    SELECT hash FROM drizzle.__drizzle_migrations
  `;
  const appliedHashes = new Set(applied.map((r) => r.hash));

  for (const entry of journal.entries) {
    const sqlPath = `${migrationsFolder}/${entry.tag}.sql`;
    if (!existsSync(sqlPath)) {
      throw new Error(`Migration file not found: ${sqlPath}`);
    }

    const content = readFileSync(sqlPath, "utf8");
    const hash = createHash("sha256").update(content).digest("hex");

    if (appliedHashes.has(hash)) continue;

    // Run each statement separated by the drizzle breakpoint marker
    const statements = content
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

    await sql.begin(async (tx) => {
      for (const stmt of statements) {
        await tx.unsafe(stmt);
      }
      await tx`
        INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
        VALUES (${hash}, ${entry.when})
      `;
    });

    console.log(`  Applied: ${entry.tag}`);
  }
}

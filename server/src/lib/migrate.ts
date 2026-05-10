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

// Postgres error codes that mean "already applied via db:push or earlier run"
const ALREADY_EXISTS_CODES = new Set([
  "42P07", // relation already exists
  "42701", // column already exists
  "42710", // constraint already exists (duplicate_object)
  "23505", // unique_violation (e.g. duplicate INSERT)
]);

/**
 * Custom migration runner for Bun + postgres.js.
 *
 * Drizzle's built-in migrate() uses timestamp (bigint) comparison, which
 * breaks on Bun because Number(postgres_bigint) truncates to int32, making
 * every migration appear unrun. This runner compares by hash (a text column),
 * which roundtrips correctly through postgres.js on Bun.
 *
 * When individual SQL statements fail with "already exists" error codes
 * (42P07, 42701, 42710) — which happen when the schema was applied via
 * db:push without journal tracking — the statement is skipped rather than
 * crashing the server. The migration hash is still recorded so the runner
 * won't attempt it again on next boot.
 */
export async function runMigrations(sql: Sql, migrationsFolder: string): Promise<void> {
  const journalPath = `${migrationsFolder}/meta/_journal.json`;
  if (!existsSync(journalPath)) {
    throw new Error(`No migration journal found at ${journalPath}`);
  }

  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as Journal;

  await sql`CREATE SCHEMA IF NOT EXISTS drizzle`;
  await sql`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id   SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `;

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

    // Run each statement; tolerate "already exists" errors from db:push pre-application
    const statements = content
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

    let skippedCount = 0;
    for (const stmt of statements) {
      try {
        await sql.unsafe(stmt);
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code && ALREADY_EXISTS_CODES.has(code)) {
          skippedCount++;
          // schema already in place from a previous db:push — safe to continue
        } else {
          throw err;
        }
      }
    }

    // Record the migration as applied regardless of skipped statements
    await sql`
      INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
      VALUES (${hash}, ${entry.when})
    `;

    if (skippedCount > 0) {
      console.log(`  Applied: ${entry.tag} (${skippedCount} statement(s) already present)`);
    } else {
      console.log(`  Applied: ${entry.tag}`);
    }
  }
}

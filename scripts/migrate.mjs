#!/usr/bin/env node
// Applies supabase/migrations/*.sql that the database has not seen yet.
// Runs as Railway's pre-deploy command (see .railway/railway.ts): a failed migration
// stops the deployment and the previous version keeps serving.
//
// Applied versions are recorded in supabase_migrations.schema_migrations – the table
// the Supabase CLI uses – so `supabase db push` and this runner agree on what is applied.
// Each migration runs in its own transaction; an advisory lock serialises concurrent
// runs (api and worker deploy at the same time).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const DEFAULT_DIR = fileURLToPath(new URL("../supabase/migrations", import.meta.url));
const LOCK_KEY = "czyzyk:migrations";

/** "0004_ingest.sql" → { version: "0004", name: "ingest" } (Supabase CLI convention). */
export function parseMigrationFile(file) {
  const match = /^(\d+)_(.+)\.sql$/.exec(file);
  if (!match) throw new Error(`Unexpected migration file name: ${file}`);
  return { version: match[1], name: match[2] };
}

export async function migrate({ databaseUrl, dir = DEFAULT_DIR, log = console.log } = {}) {
  if (!databaseUrl) throw new Error("DATABASE_URL is not set");
  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL is not a valid URL (expected postgresql://user:password@host:5432/postgres)");
  }
  if (!parsed.password) {
    throw new Error("DATABASE_URL has no password – expected postgresql://user:password@host:5432/postgres (is the ':' between user and password missing?)");
  }
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const client = new pg.Client({ connectionString: databaseUrl, application_name: "czyzyk-migrate" });
  await client.connect();
  const applied = [];
  try {
    await client.query("select pg_advisory_lock(hashtextextended($1, 0))", [LOCK_KEY]);
    await client.query(`
      create schema if not exists supabase_migrations;
      create table if not exists supabase_migrations.schema_migrations (
        version text primary key,
        statements text[],
        name text
      )`);
    const { rows } = await client.query("select version from supabase_migrations.schema_migrations");
    const done = new Set(rows.map((r) => r.version));

    for (const file of files) {
      const { version, name } = parseMigrationFile(file);
      if (done.has(version)) continue;
      const sql = readFileSync(join(dir, file), "utf8");
      log(`applying ${file}`);
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query(
          "insert into supabase_migrations.schema_migrations (version, statements, name) values ($1, $2, $3)",
          [version, [sql], name],
        );
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw new Error(`migration ${file} failed: ${error.message}`, { cause: error });
      }
      applied.push(file);
    }
    log(applied.length ? `applied ${applied.length} migration(s)` : "database is up to date");
    return applied;
  } finally {
    await client.query("select pg_advisory_unlock(hashtextextended($1, 0))", [LOCK_KEY]).catch(() => {});
    await client.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  migrate({ databaseUrl: process.env.DATABASE_URL }).catch((error) => {
    // Never print the connection string; the message names the failing file and the SQL error.
    console.error(error.message);
    process.exit(1);
  });
}

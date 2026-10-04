import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "..", "migrations");

export const ADMIN_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/postgres";

export function migrationFiles(): string[] {
  return readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => join(migrationsDir, f));
}

export interface TestDb {
  url: string;
  client: pg.Client;
  drop(): Promise<void>;
}

/** Creates a fresh database with the Supabase stub and every migration applied. */
export async function createTestDb(): Promise<TestDb> {
  const name = `czyzyk_test_${randomUUID().replaceAll("-", "")}`;
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`create database ${name}`);
  await admin.end();

  const url = new URL(ADMIN_URL);
  url.pathname = `/${name}`;
  const client = new pg.Client({ connectionString: url.toString() });
  await client.connect();
  await client.query(readFileSync(join(here, "stub_supabase.sql"), "utf8"));
  for (const file of migrationFiles()) {
    await client.query(readFileSync(file, "utf8"));
  }

  return {
    url: url.toString(),
    client,
    async drop() {
      await client.end();
      const a = new pg.Client({ connectionString: ADMIN_URL });
      await a.connect();
      await a.query(`drop database if exists ${name} with (force)`);
      await a.end();
    },
  };
}

export type Actor =
  | { kind: "anon" }
  | { kind: "user"; id: string }
  | { kind: "service" }
  | { kind: "auth_admin" };

export const anon: Actor = { kind: "anon" };
export const service: Actor = { kind: "service" };
export const authAdmin: Actor = { kind: "auth_admin" };
export const user = (id: string): Actor => ({ kind: "user", id });

/**
 * Runs `fn` inside a transaction that impersonates a Supabase API role, the way
 * PostgREST does (role + JWT claims), then rolls back unless `commit` is set.
 */
export async function as<T>(
  client: pg.Client,
  actor: Actor,
  fn: (q: (sql: string, params?: unknown[]) => Promise<pg.QueryResult>) => Promise<T>,
  { commit = false }: { commit?: boolean } = {},
): Promise<T> {
  await client.query("begin");
  try {
    const role = { anon: "anon", user: "authenticated", service: "service_role", auth_admin: "supabase_auth_admin" }[
      actor.kind
    ];
    await client.query(`set local role ${role}`);
    const sub = actor.kind === "user" ? actor.id : "";
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [sub]);
    const result = await fn((sql, params) => client.query(sql, params));
    await client.query(commit ? "commit" : "rollback");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

/** Creates an auth user the way Supabase Auth would (profile comes from the trigger). */
export async function createAuthUser(client: pg.Client, email: string, fullName = "Test"): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    "insert into auth.users (email, raw_app_meta_data, raw_user_meta_data) values ($1, $2, $3) returning id",
    [email, { provider: "google" }, { full_name: fullName }],
  );
  return rows[0]!.id;
}

export async function allowEmail(client: pg.Client, email: string, role: "admin" | "family"): Promise<void> {
  await client.query("insert into public.allowed_emails (email, role) values ($1, $2)", [email, role]);
}

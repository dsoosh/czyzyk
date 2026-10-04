import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createEmptyDb, type TestDb } from "../supabase/tests/db.js";
// @ts-expect-error -- plain ESM script without type declarations
import { migrate, parseMigrationFile } from "./migrate.mjs";

const migrationsDir = fileURLToPath(new URL("../supabase/migrations", import.meta.url));
const silent = () => {};

let db: TestDb;

beforeAll(async () => {
  db = await createEmptyDb();
});

afterAll(async () => {
  await db?.drop();
});

describe("migrate", () => {
  it("applies every migration once and records it like the Supabase CLI", async () => {
    const applied: string[] = await migrate({ databaseUrl: db.url, log: silent });
    expect(applied.length).toBeGreaterThanOrEqual(4);
    expect(applied[0]).toBe("0001_schema.sql");

    const { rows } = await db.client.query("select version, name from supabase_migrations.schema_migrations order by version");
    expect(rows[0]).toEqual({ version: "0001", name: "schema" });
    expect((await db.client.query("select to_regclass('public.messages') as t")).rows[0].t).toBe("messages");

    expect(await migrate({ databaseUrl: db.url, log: silent })).toEqual([]);
  });

  it("rolls back a failing migration and stops before later ones", async () => {
    const dir = mkdtempSync(join(tmpdir(), "migrations-"));
    for (const f of ["0001_schema.sql", "0002_auth.sql", "0003_admin_rpc.sql", "0004_ingest.sql"]) {
      writeFileSync(join(dir, f), readFileSync(join(migrationsDir, f), "utf8"));
    }
    writeFileSync(join(dir, "0090_broken.sql"), "create table public.half_done (id int); select 1/0;");
    writeFileSync(join(dir, "0091_later.sql"), "create table public.later (id int);");

    await expect(migrate({ databaseUrl: db.url, dir, log: silent })).rejects.toThrow("migration 0090_broken.sql failed");
    const exists = async (t: string) => (await db.client.query("select to_regclass($1) as t", [`public.${t}`])).rows[0].t;
    expect(await exists("half_done")).toBeNull();
    expect(await exists("later")).toBeNull();
    const { rows } = await db.client.query("select 1 from supabase_migrations.schema_migrations where version = '0090'");
    expect(rows).toHaveLength(0);
  });

  it("serialises concurrent runs", async () => {
    const fresh = await createEmptyDb();
    try {
      const results: string[][] = await Promise.all([
        migrate({ databaseUrl: fresh.url, log: silent }),
        migrate({ databaseUrl: fresh.url, log: silent }),
      ]);
      expect(results.map((r) => r.length).sort()).toEqual([0, results.flat().length]);
    } finally {
      await fresh.drop();
    }
  });

  it("parses Supabase-style file names", () => {
    expect(parseMigrationFile("0004_ingest.sql")).toEqual({ version: "0004", name: "ingest" });
    expect(() => parseMigrationFile("notes.sql")).toThrow();
  });
});

import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, createAuthUser, createTestDb, user, type TestDb } from "./db.js";

// 0036: old items addressed to all of the operator's children in the group become whole-group items.
let db: TestDb;
let wilki: string;
let kasiaId: string;

const migration = readFileSync(new URL("../migrations/0036_whole_group_items.sql", import.meta.url), "utf8");

beforeAll(async () => {
  db = await createTestDb();
  const q = (sql: string, params: unknown[] = []) => db.client.query(sql, params);
  const operator = (await q("insert into families (name, created_at) values ('Rodzina', '2026-01-01') returning id")).rows[0].id;
  const other = (await q("insert into families (name) values ('Rodzina Kasi') returning id")).rows[0].id;
  await q("insert into allowed_emails (email, role, family_id) values ('kasia@example.com', 'family', $1)", [other]);
  kasiaId = await createAuthUser(db.client, "kasia@example.com", "Kasia");
  wilki = (await q("insert into wa_groups (wa_name, tracked) values ('Wilki', true) returning id")).rows[0].id;
  const sowy = (await q("insert into wa_groups (wa_name, tracked) values ('Sowy', true) returning id")).rows[0].id;
  await q("insert into children (family_id, name, group_id) values ($1, 'Zosia', $2), ($1, 'Staś', $3)", [operator, wilki, sowy]);
  await q("insert into children (family_id, name, group_id) values ($1, 'Lena', $2)", [other, wilki]);
  const event = (title: string, audience: string[], created: string) =>
    q("insert into events (group_id, title, starts_at, audience, created_at) values ($1, $2, now(), $3, $4)", [wilki, title, audience, created]);
  await event("wycieczka", ["Zosia"], "2026-10-01");
  await event("Zosia: zdjęcia", ["Zosia", "Antek"], "2026-10-01");
  await event("nowe dla Zosi", ["Zosia"], "2026-10-10");
  await db.client.query(migration);
});

afterAll(async () => {
  await db?.drop();
});

const visible = async () =>
  (await as(db.client, user(kasiaId), async (q) => (await q("select title from events order by title")).rows)).map((r) => r.title);

describe("stare sprawy całej grupy", () => {
  it("stara sprawa dla wszystkich dzieci operatora w grupie staje się wspólna; inne zostają", async () => {
    expect(await visible()).toEqual(["wycieczka"]);
    const { rows } = await db.client.query("select title, audience from events");
    expect(Object.fromEntries(rows.map((r) => [r.title, r.audience]))).toEqual({
      "nowe dla Zosi": ["Zosia"],
      wycieczka: [],
      "Zosia: zdjęcia": ["Zosia", "Antek"],
    });
  });
});

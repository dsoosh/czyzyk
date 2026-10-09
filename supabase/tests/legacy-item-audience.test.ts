import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, createAuthUser, createTestDb, user, type TestDb } from "./db.js";

// 0037: old items get their audience from the children named in their source messages.
let db: TestDb;
let wilki: string;
let operator: string;
let olaId: string;
let kasiaId: string;

beforeAll(async () => {
  db = await createTestDb();
  const q = (sql: string, params: unknown[] = []) => db.client.query(sql, params);
  operator = (await q("insert into families (name) values ('Rodzina Oli') returning id")).rows[0].id;
  const other = (await q("insert into families (name) values ('Rodzina Kasi') returning id")).rows[0].id;
  await q("insert into allowed_emails (email, role, family_id) values ('ola@example.com', 'family', $1), ('kasia@example.com', 'family', $2)", [
    operator,
    other,
  ]);
  olaId = await createAuthUser(db.client, "ola@example.com", "Ola");
  kasiaId = await createAuthUser(db.client, "kasia@example.com", "Kasia");
  wilki = (await q("insert into wa_groups (wa_name, tracked) values ('Wilki', true) returning id")).rows[0].id;
  await q("insert into children (family_id, name, group_id) values ($1, 'Zosia', $2)", [operator, wilki]);
  await q("insert into children (family_id, name, group_id) values ($1, 'Antek', $2)", [other, wilki]);
  const zosia = (await q("select id from children where name = 'Zosia'")).rows[0].id;

  const legacy = async (title: string, text: string) => {
    const msg = (await q("insert into messages (group_id, author, sent_at, text, source, dedupe_key) values ($1, 'Pani', now(), $2, 'export', $3) returning id", [
      wilki,
      text,
      title,
    ])).rows[0].id;
    await q(
      "insert into events (group_id, title, starts_at, audience, child_ids, source_message_ids, legacy_audience) values ($1, $2, now(), '{}', $3, $4, true)",
      [wilki, title, [zosia], [msg]],
    );
  };
  await legacy("wycieczka", "Jutro wycieczka do Zoo, zbiórka o 8:00.");
  await legacy("kapcie Zosi", "Zosia zapomniała dziś kapci, proszę je przynieść.");
  await legacy("zdjęcia", "Prośba do rodziców Zosi i Antka o zgody na zdjęcia.");
  await legacy("Lenka", "Lence trzeba odebrać plecak.");
  await q("select public.refresh_item_children()");
});

afterAll(async () => {
  await db?.drop();
});

const titles = async (actor: string) =>
  (await as(db.client, user(actor), async (q) => (await q("select title from events")).rows)).map((r) => r.title).sort();

describe("adresaci starych spraw", () => {
  it("dziecko wymienione w wiadomości (także w odmianie) – sprawa dla niego; bez imion – dla całej grupy", async () => {
    const { rows } = await db.client.query("select title, audience from events");
    expect(Object.fromEntries(rows.map((r) => [r.title, r.audience]))).toEqual({
      wycieczka: [],
      "kapcie Zosi": ["Zosia"],
      zdjęcia: ["Antek", "Zosia"],
      Lenka: [],
    });
    expect(await titles(olaId)).toEqual(["Lenka", "kapcie Zosi", "wycieczka", "zdjęcia"].sort());
    expect(await titles(kasiaId)).toEqual(["Lenka", "wycieczka", "zdjęcia"].sort());
  });

  it("dziecko dodane później i wymienione w starej wiadomości dostaje sprawę", async () => {
    await as(db.client, user(kasiaId), (q) => q("select * from save_child(null, 'Lena', $1, '{}')", [wilki]), { commit: true });
    const { rows } = await db.client.query("select audience from events where title = 'Lenka'");
    expect(rows).toEqual([{ audience: ["Lena"] }]);
    expect(await titles(olaId)).not.toContain("Lenka");
    expect(await titles(kasiaId)).toContain("Lenka");
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, createAuthUser, createTestDb, user, type TestDb } from "./db.js";

// Two families in one group (families, two-step extraction): Ola's Zosia and Kasia's Lena attend
// Wilki. Items addressed to a child are visible only to that child's family.
let db: TestDb;
let familyA: string;
let familyB: string;
let olaId: string;
let kasiaId: string;
let wilki: string;
let sowy: string;
let ogloszenia: string;

beforeAll(async () => {
  db = await createTestDb();
  const q = (sql: string, params: unknown[] = []) => db.client.query(sql, params);
  familyA = (await q("insert into families (name) values ('Rodzina Oli') returning id")).rows[0].id;
  familyB = (await q("insert into families (name) values ('Rodzina Kasi') returning id")).rows[0].id;
  await q("insert into allowed_emails (email, role, family_id) values ('ola@example.com', 'family', $1), ('kasia@example.com', 'family', $2)", [
    familyA,
    familyB,
  ]);
  olaId = await createAuthUser(db.client, "ola@example.com", "Ola");
  kasiaId = await createAuthUser(db.client, "kasia@example.com", "Kasia");
  const group = async (name: string, shared = false) =>
    (await q("insert into wa_groups (wa_name, tracked, shared) values ($1, true, $2) returning id", [name, shared])).rows[0].id as string;
  wilki = await group("Wilki");
  sowy = await group("Sowy");
  ogloszenia = await group("Ogłoszenia", true);
  await q("insert into children (family_id, name, group_id) values ($1, 'Zosia', $2)", [familyA, wilki]);
  await q("insert into children (family_id, name, group_id, aliases) values ($1, 'Lena', $2, '{Lenka}')", [familyB, wilki]);
});

afterAll(async () => {
  await db?.drop();
});

const read = (actor: string, sql: string, params: unknown[] = []) =>
  as(db.client, user(actor), async (q) => (await q(sql, params)).rows);
const commit = (actor: string, sql: string, params: unknown[] = []) =>
  as(db.client, user(actor), async (q) => (await q(sql, params)).rows, { commit: true });
const sees = async (actor: string, description: string) =>
  (await read(actor, "select id from bring_items where description = $1", [description])).length === 1;

async function bring(description: string, groupId: string, audience: string[], extra: string[] = []) {
  await db.client.query(
    "insert into bring_items (group_id, description, audience, extra_group_ids) values ($1, $2, $3, $4)",
    [groupId, description, audience, extra],
  );
  await db.client.query("select public.refresh_item_children()");
}

describe("adresaci spraw", () => {
  it("sprawa dla całej grupy dla wszystkich rodzin grupy, sprawa dla dziecka tylko dla jego rodziny", async () => {
    await bring("kapcie", wilki, []);
    await bring("kasztany", wilki, ["Lenka"]);
    expect(await sees(olaId, "kapcie")).toBe(true);
    expect(await sees(kasiaId, "kapcie")).toBe(true);
    expect(await sees(olaId, "kasztany")).toBe(false);
    expect(await sees(kasiaId, "kasztany")).toBe(true);
    const { rows } = await db.client.query("select c.name from bring_items b join children c on c.id = any(b.child_ids) where b.description = 'kasztany'");
    expect(rows).toEqual([{ name: "Lena" }]);
  });

  it("imię nieznanego dziecka: sprawy nie widzi żadna rodzina, aż dziecko zostanie dodane", async () => {
    await bring("liście", wilki, ["Antek"]);
    expect(await sees(olaId, "liście")).toBe(false);
    const [antoni] = await commit(olaId, "select * from save_child(null, 'Antoni', $1, '{Antek}')", [wilki]);
    expect(await sees(olaId, "liście")).toBe(true);
    expect(await sees(kasiaId, "liście")).toBe(false);
    await commit(olaId, "select delete_child($1)", [antoni.id]);
    expect(await sees(olaId, "liście")).toBe(false);
    expect((await db.client.query("select child_ids from bring_items where description = 'liście'")).rows[0].child_ids).toEqual([]);
  });

  it("grupa wspólna dopasowuje dzieci z dowolnej grupy", async () => {
    await bring("strój na bal", ogloszenia, ["Lena"]);
    expect(await sees(kasiaId, "strój na bal")).toBe(true);
    expect(await sees(olaId, "strój na bal")).toBe(false);
  });

  it("wspólna sprawa dwóch grup: dodatkowa grupa daje widoczność jej rodzinom", async () => {
    await bring("bilet do Zajezdni", sowy, [], [wilki]);
    expect(await sees(olaId, "bilet do Zajezdni")).toBe(true);
    await bring("plecak", sowy, []);
    expect(await sees(olaId, "plecak")).toBe(false);
  });

  it("akcja rodziny przenosi adresatów na utworzoną rzecz", async () => {
    const { rows } = await db.client.query(
      `insert into action_required (group_id, question, audience, suggested_actions, confidence)
       values ($1, 'Kupić spray', '{Zosia}', $2, 0.9) returning id`,
      [wilki, JSON.stringify([{ kind: "bring", label: "Kupić i przynieść", description: "spray" }])],
    );
    await db.client.query("select public.refresh_item_children()");
    await expect(read(kasiaId, "select apply_action_suggestion($1, 0)", [rows[0].id])).rejects.toMatchObject({ code: "P0002" });
    await commit(olaId, "select apply_action_suggestion($1, 0)", [rows[0].id]);
    const { rows: spray } = await db.client.query("select audience, family_id from bring_items where description = 'spray'");
    expect(spray).toEqual([{ audience: ["Zosia"], family_id: familyA }]);
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anon, as, createAuthUser, createTestDb, user, type TestDb } from "./db.js";

// Two families (families): Ola's children attend Motylki, Kasia's daughter attends Wilki;
// "Ogłoszenia" is shared. The operator (Darek, admin) sees everything.
let db: TestDb;
let familyA: string;
let familyB: string;
let olaId: string;
let kasiaId: string;
let darekId: string;
const strangerId = "22222222-2222-2222-2222-222222222222";
const ids: Record<string, string> = {};

beforeAll(async () => {
  db = await createTestDb();
  const q = (sql: string, params: unknown[] = []) => db.client.query(sql, params);
  familyA = (await q("insert into families (name) values ('Rodzina Oli') returning id")).rows[0].id;
  familyB = (await q("insert into families (name) values ('Rodzina Kasi') returning id")).rows[0].id;
  await q("insert into allowed_emails (email, role, family_id) values ('ola@example.com', 'family', $1)", [familyA]);
  await q("insert into allowed_emails (email, role, family_id) values ('darek@example.com', 'admin', $1)", [familyA]);
  await q("insert into allowed_emails (email, role, family_id) values ('kasia@example.com', 'family', $1)", [familyB]);
  olaId = await createAuthUser(db.client, "ola@example.com", "Ola");
  darekId = await createAuthUser(db.client, "darek@example.com", "Darek");
  kasiaId = await createAuthUser(db.client, "kasia@example.com", "Kasia");

  const group = async (name: string, shared = false) =>
    (await q("insert into wa_groups (wa_name, tracked, shared) values ($1, true, $2) returning id", [name, shared])).rows[0].id as string;
  ids.motylki = await group("Motylki");
  ids.wilki = await group("Wilki");
  ids.ogloszenia = await group("Ogłoszenia", true);
  await q("insert into children (family_id, name, group_id) values ($1, 'Zosia', $2)", [familyA, ids.motylki]);
  await q("insert into children (family_id, name, group_id) values ($1, 'Lena', $2)", [familyB, ids.wilki]);

  for (const [key, groupId] of [["motylki", ids.motylki], ["wilki", ids.wilki], ["ogloszenia", ids.ogloszenia]] as const) {
    const { rows: m } = await q(
      `insert into messages (group_id, author, sent_at, text, source, dedupe_key)
       values ($1, 'Pani Ania', now(), $2, 'notification', $2) returning id`,
      [groupId, `wiadomość ${key}`],
    );
    ids[`msg_${key}`] = m[0].id;
    const { rows: a } = await q(
      "insert into attachments (message_id, screening, doc_status, mime) values ($1, 'image', 'ready', 'image/jpeg') returning id",
      [m[0].id],
    );
    ids[`att_${key}`] = a[0].id;
    await q("insert into attachment_files (attachment_id, mime, bytes) values ($1, 'image/jpeg', '\\xffd8ffd9')", [a[0].id]);
    const { rows: e } = await q("insert into events (group_id, title, starts_at) values ($1, $2, now()) returning id", [
      groupId,
      `wydarzenie ${key}`,
    ]);
    ids[`event_${key}`] = e[0].id;
    await q("insert into item_changes (item_type, item_id, op) values ('event', $1, 'create')", [e[0].id]);
    const { rows: p } = await q("insert into payments (group_id, description) values ($1, $2) returning id", [groupId, `płatność ${key}`]);
    ids[`payment_${key}`] = p[0].id;
  }
  ids.kindergarten = (await q("insert into events (group_id, title, starts_at) values (null, 'Dzień otwarty', now()) returning id")).rows[0].id;
  await q("insert into contact_roles (author_key, role, label, profile_id) values ('+48500000001', 'rodzina', 'Kasia', $1)", [kasiaId]);
  await q("insert into contact_roles (author_key, role, label) values ('+48500000002', 'ciocia', 'Pani Ania')");
});

afterAll(async () => {
  await db?.drop();
});

const read = (actor: string, sql: string, params: unknown[] = []) =>
  as(db.client, user(actor), async (q) => (await q(sql, params)).rows);
const titles = async (actor: string) => (await read(actor, "select title from events order by title")).map((r) => r.title);

describe("widoczność według grup dzieci", () => {
  it("rodzina widzi grupę swojego dziecka, grupę wspólną i całe przedszkole – nie cudzą grupę", async () => {
    expect(await titles(olaId)).toEqual(["Dzień otwarty", "wydarzenie motylki", "wydarzenie ogloszenia"]);
    expect(await titles(kasiaId)).toEqual(["Dzień otwarty", "wydarzenie ogloszenia", "wydarzenie wilki"]);
    const groups = async (actor: string) => (await read(actor, "select wa_name from wa_groups order by wa_name")).map((r) => r.wa_name);
    expect(await groups(olaId)).toEqual(["Motylki", "Ogłoszenia"]);
    expect(await groups(kasiaId)).toEqual(["Ogłoszenia", "Wilki"]);
  });

  it("wiadomości, załączniki, płatności i historia zmian cudzej grupy są niewidoczne", async () => {
    expect(await read(olaId, "select id from messages where id = $1", [ids.msg_wilki])).toEqual([]);
    expect(await read(olaId, "select id from attachments where id = $1", [ids.att_wilki])).toEqual([]);
    expect(await read(olaId, "select id from payments where id = $1", [ids.payment_wilki])).toEqual([]);
    expect(await read(olaId, "select id from family_payments where id = $1", [ids.payment_wilki])).toEqual([]);
    expect(await read(olaId, "select id from item_changes where item_id = $1", [ids.event_wilki])).toEqual([]);
    expect(await read(olaId, "select id from message_context($1)", [ids.msg_wilki])).toEqual([]);
    expect(await read(olaId, "select * from attachment_image($1)", [ids.att_wilki])).toEqual([]);
    expect(await read(kasiaId, "select * from attachment_image($1)", [ids.att_wilki])).toHaveLength(1);
    expect(await read(kasiaId, "select id from item_changes where item_id = $1", [ids.event_wilki])).toHaveLength(1);
  });

  it("operator widzi wszystko; osoba spoza listy i anonim nic", async () => {
    expect(await titles(darekId)).toHaveLength(4);
    expect(await read(strangerId, "select id from events")).toEqual([]);
    expect(await read(strangerId, "select id from family_payments")).toEqual([]);
    await expect(as(db.client, anon, (q) => q("select id from events"))).rejects.toMatchObject({ code: "42501" });
  });

  it("listę śledzonych grup do wyboru dla dziecka dostaje każda rodzina", async () => {
    const rows = await read(olaId, "select name, shared from trackable_groups()");
    expect(rows).toEqual([
      { name: "Motylki", shared: false },
      { name: "Ogłoszenia", shared: true },
      { name: "Wilki", shared: false },
    ]);
    await expect(read(strangerId, "select * from trackable_groups()")).rejects.toMatchObject({ code: "42501" });
  });

  it("grupa wspólna: tylko operator ją oznacza, a widzą ją wszyscy", async () => {
    await expect(read(olaId, "select admin_update_group($1, true, null, true)", [ids.wilki])).rejects.toMatchObject({ code: "42501" });
    await as(db.client, user(darekId), (q) => q("select admin_update_group($1, true, null, true)", [ids.wilki]), { commit: true });
    expect(await titles(olaId)).toContain("wydarzenie wilki");
    await db.client.query("update wa_groups set shared = false where id = $1", [ids.wilki]);
    expect(await titles(olaId)).not.toContain("wydarzenie wilki");
  });
});

describe("dzieci, profile i kontakty w obrębie rodziny", () => {
  it("każda rodzina widzi tylko swoje dzieci i może użyć tego samego imienia i koloru", async () => {
    expect((await read(olaId, "select name from children")).map((r) => r.name)).toEqual(["Zosia"]);
    const [lena] = await as(db.client, user(olaId), async (q) => (await q("select * from save_child(null, 'Lena', $1)", [ids.motylki])).rows, {
      commit: true,
    });
    expect(lena.family_id).toBe(familyA);
    expect((await read(kasiaId, "select name from children")).map((r) => r.name)).toEqual(["Lena"]);
  });

  it("rodzina nie zmienia ani nie usuwa cudzego dziecka", async () => {
    const { rows } = await db.client.query("select id from children where family_id = $1", [familyB]);
    await expect(read(olaId, "select save_child($1, 'Hania', null)", [rows[0].id])).rejects.toMatchObject({ code: "P0002" });
    await as(db.client, user(olaId), (q) => q("select delete_child($1)", [rows[0].id]), { commit: true });
    expect((await db.client.query("select count(*)::int as n from children where id = $1", [rows[0].id])).rows[0].n).toBe(1);
  });

  it("profile i numery „rodzina” innej rodziny są niewidoczne", async () => {
    const names = async (actor: string) => (await read(actor, "select display_name from profiles order by display_name")).map((r) => r.display_name);
    expect(await names(olaId)).toEqual(["Darek", "Ola"]);
    expect(await names(kasiaId)).toEqual(["Kasia"]);
    expect((await read(olaId, "select label from contact_roles order by label")).map((r) => r.label)).toEqual(["Pani Ania"]);
    expect((await read(kasiaId, "select label from contact_roles order by label")).map((r) => r.label)).toEqual(["Kasia", "Pani Ania"]);
  });
});

describe("stan „zrobione” osobno dla rodziny", () => {
  it("zapłata wspólnej płatności przez jedną rodzinę nie zmienia stanu drugiej", async () => {
    await as(db.client, user(kasiaId), (q) => q("select mark_paid($1, true)", [ids.payment_ogloszenia]), { commit: true });
    const paid = async (actor: string) => (await read(actor, "select paid_at from family_payments where id = $1", [ids.payment_ogloszenia]))[0].paid_at;
    expect(await paid(kasiaId)).toBeInstanceOf(Date);
    expect(await paid(olaId)).toBeNull();
    expect(await read(olaId, "select * from item_done")).toEqual([]);
  });

  it("nie da się oznaczyć elementu z cudzej grupy", async () => {
    await expect(read(olaId, "select mark_paid($1, true)", [ids.payment_wilki])).rejects.toMatchObject({ code: "P0002" });
  });

  it("element utworzony z wyboru rodziny widzi tylko ta rodzina", async () => {
    const { rows } = await db.client.query(
      `insert into action_required (group_id, question, suggested_actions, confidence)
       values ($1, 'Kupić spray', $2, 0.9) returning id`,
      [ids.ogloszenia, JSON.stringify([{ kind: "bring", label: "Kupić i przynieść", description: "spray" }])],
    );
    await as(db.client, user(olaId), (q) => q("select apply_action_suggestion($1, 0)", [rows[0].id]), { commit: true });
    const spray = async (actor: string) => (await read(actor, "select id from bring_items where description = 'spray'")).length;
    expect(await spray(olaId)).toBe(1);
    expect(await spray(kasiaId)).toBe(0);
    const open = async (actor: string) =>
      (await read(actor, "select resolved_at from family_action_required where id = $1", [rows[0].id]))[0].resolved_at;
    expect(await open(olaId)).toBeInstanceOf(Date);
    expect(await open(kasiaId)).toBeNull();
  });
});

describe("rodzina nowego adresu", () => {
  it("adres dodany bez rodziny trafia do pierwszej rodziny", async () => {
    await db.client.query("insert into allowed_emails (email, role) values ('nowy@example.com', 'family')");
    const { rows } = await db.client.query("select family_id from allowed_emails where email = 'nowy@example.com'");
    expect(rows[0].family_id).toBe(familyA);
  });
});

describe("dodanie i usunięcie dziecka", () => {
  it("nowe dziecko od razu pokazuje istniejące sprawy jego grupy; usunięcie chowa je i sprząta stan rodziny", async () => {
    const familyC = (await db.client.query("insert into families (name) values ('Rodzina Ewy') returning id")).rows[0].id;
    await db.client.query("insert into allowed_emails (email, role, family_id) values ('ewa@example.com', 'family', $1)", [familyC]);
    const ewaId = await createAuthUser(db.client, "ewa@example.com", "Ewa");
    const commit = (sql: string, params: unknown[] = []) =>
      as(db.client, user(ewaId), async (q) => (await q(sql, params)).rows, { commit: true });
    const wilki = async () => (await titles(ewaId)).filter((t) => t.includes("wilki"));

    expect(await wilki()).toEqual([]);
    const [hania] = await commit("select * from save_child(null, 'Hania', $1)", [ids.wilki]);
    expect(await wilki()).toEqual(["wydarzenie wilki"]);
    expect(await read(ewaId, "select id from messages where id = $1", [ids.msg_wilki])).toHaveLength(1);

    await commit("select mark_paid($1, true)", [ids.payment_wilki]);
    await as(db.client, user(kasiaId), (q) => q("select mark_paid($1, true)", [ids.payment_wilki]), { commit: true });
    await db.client.query("insert into bring_items (group_id, family_id, description) values ($1, $2, 'spray Ewy')", [ids.wilki, familyC]);
    await db.client.query("update events set child_ids = array[$1::uuid] where id = $2", [hania.id, ids.event_wilki]);

    await commit("select delete_child($1)", [hania.id]);
    expect(await wilki()).toEqual([]);
    expect((await db.client.query("select family_id from item_done where item_id = $1", [ids.payment_wilki])).rows).toEqual([
      { family_id: familyB },
    ]);
    expect((await db.client.query("select count(*)::int as n from bring_items where description = 'spray Ewy'")).rows[0].n).toBe(0);
    expect((await db.client.query("select child_ids from events where id = $1", [ids.event_wilki])).rows[0].child_ids).toEqual([]);
  });

  it("przeniesienie dziecka do innej grupy chowa starą grupę, jeśli nie chodzi do niej inne dziecko rodziny", async () => {
    const familyD = (await db.client.query("insert into families (name) values ('Rodzina Jana') returning id")).rows[0].id;
    await db.client.query("insert into allowed_emails (email, role, family_id) values ('jan@example.com', 'family', $1)", [familyD]);
    const janId = await createAuthUser(db.client, "jan@example.com", "Jan");
    const commit = (sql: string, params: unknown[] = []) =>
      as(db.client, user(janId), async (q) => (await q(sql, params)).rows, { commit: true });
    const [kuba] = await commit("select * from save_child(null, 'Kuba', $1)", [ids.wilki]);
    await commit("select mark_paid($1, true)", [ids.payment_wilki]);
    await commit("select save_child($1, 'Kuba', $2)", [kuba.id, ids.motylki]);
    expect(await titles(janId)).toContain("wydarzenie motylki");
    expect(await titles(janId)).not.toContain("wydarzenie wilki");
    expect((await db.client.query("select count(*)::int as n from item_done where family_id = $1", [familyD])).rows[0].n).toBe(0);
  });
});

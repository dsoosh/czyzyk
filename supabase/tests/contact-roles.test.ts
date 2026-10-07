import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { allowEmail, anon, as, createAuthUser, createTestDb, user, type TestDb } from "./db.js";

let db: TestDb;
let adminId: string;
let olaId: string;

beforeAll(async () => {
  db = await createTestDb();
  await allowEmail(db.client, "darek@example.com", "admin");
  await allowEmail(db.client, "ola@example.com", "family");
  adminId = await createAuthUser(db.client, "darek@example.com", "Darek Nowak");
  olaId = await createAuthUser(db.client, "ola@example.com", "Ola");
  const { rows } = await db.client.query<{ id: string }>(
    "insert into wa_groups (wa_name, tracked) values ('Motylki', true), ('Sąsiedzi', false) returning id",
  );
  await db.client.query(
    `insert into messages (group_id, author, sent_at, text, source, dedupe_key) values
       ($1, 'Pani Ania', '2026-10-05T10:00:00Z', 'a', 'notification', 'k1'),
       ($1, 'Pani Ania', '2026-10-06T10:00:00Z', 'b', 'notification', 'k2'),
       ($1, '+48 535 111 213', '2026-10-07T10:00:00Z', 'c', 'notification', 'k3'),
       ($2, 'Sąsiad', '2026-10-07T11:00:00Z', 'd', 'notification', 'k4')`,
    [rows[0]!.id, rows[1]!.id],
  );
});

afterAll(async () => {
  await db?.drop();
});

const asUser = (id: string, sql: string, params: unknown[] = []) =>
  as(db.client, user(id), async (q) => (await q(sql, params)).rows, { commit: true });

describe("role autorów wiadomości", () => {
  it("lista autorów: tylko śledzone grupy, najświeższy najpierw, z liczbą wiadomości", async () => {
    const rows = await asUser(olaId, "select author, messages::int from list_message_authors()");
    expect(rows).toEqual([
      { author: "+48 535 111 213", messages: 1 },
      { author: "Pani Ania", messages: 2 },
    ]);
  });

  it("admin nadaje rolę i opis, usuwa mapowanie; rodzina czyta, nie zapisuje", async () => {
    const [saved] = await asUser(adminId, "select * from admin_save_contact_role('pani ania', 'ciocia', '  Ciocia Ania (Sokoły) ')");
    expect(saved).toMatchObject({ author_key: "pani ania", role: "ciocia", label: "Ciocia Ania (Sokoły)", profile_id: null });
    expect(await asUser(olaId, "select author_key, role from contact_roles")).toEqual([{ author_key: "pani ania", role: "ciocia" }]);
    await expect(asUser(olaId, "select admin_save_contact_role('pani ania', 'rodzic', null)")).rejects.toThrow(/Brak uprawnień/);
    await expect(asUser(olaId, "insert into contact_roles (author_key, role) values ('x', 'rodzic')")).rejects.toThrow(/permission denied/);
    await expect(asUser(adminId, "select admin_save_contact_role('x', 'szef', null)")).rejects.toThrow(/contact_roles_role_check/);
    await asUser(adminId, "select admin_save_contact_role('pani ania', null, null)");
    expect(await asUser(olaId, "select * from contact_roles")).toEqual([]);
  });

  it("członek rodziny ustawia, zmienia i czyści swój numer", async () => {
    const [mine] = await asUser(olaId, "select * from set_my_phone('+48535111213')");
    expect(mine).toMatchObject({ author_key: "+48535111213", role: "rodzina", label: "Ola", profile_id: olaId });
    await asUser(olaId, "select set_my_phone('+48600700800')");
    expect(await asUser(olaId, "select author_key from contact_roles where profile_id = $1", [olaId])).toEqual([{ author_key: "+48600700800" }]);
    await expect(asUser(olaId, "select set_my_phone('Ola')")).rejects.toThrow(/To nie jest numer telefonu/);
    await asUser(olaId, "select set_my_phone(null)");
    expect(await asUser(olaId, "select * from contact_roles")).toEqual([]);
  });

  it("anonim nie czyta ról ani listy autorów", async () => {
    await expect(as(db.client, anon, (q) => q("select * from contact_roles"))).rejects.toThrow(/permission denied/);
    await expect(as(db.client, anon, (q) => q("select * from list_message_authors()"))).rejects.toThrow(/permission denied/);
  });
});

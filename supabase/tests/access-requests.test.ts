import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { allowEmail, as, createAuthUser, createTestDb, user, type TestDb } from "./db.js";

// Families joining: an unknown Google account leaves an access request; the operator approves it
// (a new family) or rejects it; a family adds and removes its own members.
let db: TestDb;
let adminId: string;
let olaId: string;

beforeAll(async () => {
  db = await createTestDb();
  await allowEmail(db.client, "darek@example.com", "admin");
  adminId = await createAuthUser(db.client, "darek@example.com", "Darek");
  await db.client.query("insert into wa_groups (wa_name, tracked) values ('Wilki', true)");
});

afterAll(async () => {
  await db?.drop();
});

const rows = (actor: string, sql: string, params: unknown[] = []) =>
  as(db.client, user(actor), async (q) => (await q(sql, params)).rows);
const commit = (actor: string, sql: string, params: unknown[] = []) =>
  as(db.client, user(actor), async (q) => (await q(sql, params)).rows, { commit: true });
const requests = async () => (await db.client.query("select email, display_name, status from access_requests order by email")).rows;

describe("prośby o dostęp", () => {
  it("konto spoza listy zapisuje prośbę i nie ma profilu ani danych", async () => {
    olaId = await createAuthUser(db.client, "Ola@Example.com", "Ola Nowak");
    expect(await requests()).toEqual([{ email: "ola@example.com", display_name: "Ola Nowak", status: "pending" }]);
    expect((await db.client.query("select 1 from profiles where id = $1", [olaId])).rows).toHaveLength(0);
    expect(await rows(olaId, "select * from wa_groups")).toEqual([]);
    expect(await rows(olaId, "select * from access_requests")).toEqual([]);
    expect(await rows(olaId, "select public.my_access_request() as s")).toEqual([{ s: "pending" }]);
    expect(await rows(olaId, "select * from public.family_members()")).toEqual([]);
    await expect(rows(olaId, "select public.family_add_member('x@example.com')")).rejects.toMatchObject({ code: "42501" });
  });

  it("tylko admin widzi i rozpatruje prośby", async () => {
    expect(await rows(adminId, "select email from access_requests")).toEqual([{ email: "ola@example.com" }]);
    await expect(rows(olaId, "select public.admin_approve_access_request('ola@example.com')")).rejects.toMatchObject({ code: "42501" });
  });

  it("akceptacja tworzy nową rodzinę i profil", async () => {
    await commit(adminId, "select public.admin_approve_access_request('ola@example.com')");
    const { rows: profile } = await db.client.query(
      "select p.role, f.name, p.family_id <> (select family_id from profiles where id = $2) as own_family from profiles p join families f on f.id = p.family_id where p.id = $1",
      [olaId, adminId],
    );
    expect(profile).toEqual([{ role: "family", name: "Rodzina Ola Nowak", own_family: true }]);
    expect(await requests()).toEqual([]);
  });

  it("odrzucenie zamyka prośbę", async () => {
    const obcyId = await createAuthUser(db.client, "obcy@example.com", "Obcy");
    await commit(adminId, "select public.admin_reject_access_request('obcy@example.com')");
    expect(await requests()).toEqual([{ email: "obcy@example.com", display_name: "Obcy", status: "rejected" }]);
    expect(await rows(obcyId, "select public.my_access_request() as s")).toEqual([{ s: "rejected" }]);
  });
});

describe("członkowie rodziny", () => {
  it("rodzina dodaje drugiego rodzica, który czekał na akceptację", async () => {
    const mezId = await createAuthUser(db.client, "maz@example.com", "Marek");
    await commit(olaId, "select public.family_add_member(' Maz@Example.com ')");
    expect(await requests()).toEqual([{ email: "obcy@example.com", display_name: "Obcy", status: "rejected" }]);
    const { rows: same } = await db.client.query("select count(distinct family_id)::int as n from profiles where id in ($1, $2)", [olaId, mezId]);
    expect(same).toEqual([{ n: 1 }]);
    expect(await rows(olaId, "select email, display_name, signed_in, is_me from public.family_members()")).toEqual([
      { email: "ola@example.com", display_name: "Ola Nowak", signed_in: true, is_me: true },
      { email: "maz@example.com", display_name: "Marek", signed_in: true, is_me: false },
    ]);
  });

  it("adres innej rodziny dostaje zaproszenie (family-invites), a admin nie widzi się w cudzej rodzinie", async () => {
    expect(await commit(olaId, "select public.family_add_member('darek@example.com') as r")).toEqual([{ r: "invited" }]);
    await commit(olaId, "select public.family_remove_member('darek@example.com')");
    await expect(commit(olaId, "select public.family_add_member('bez-malpy')")).rejects.toMatchObject({ code: "22023" });
    expect((await rows(adminId, "select email from public.family_members()")).map((r) => r.email)).toEqual(["darek@example.com"]);
  });

  it("usuwanie: nie siebie, nie cudzych, członek traci dostęp", async () => {
    await expect(commit(olaId, "select public.family_remove_member('ola@example.com')")).rejects.toMatchObject({ code: "22023" });
    await expect(commit(olaId, "select public.family_remove_member('darek@example.com')")).rejects.toMatchObject({ code: "P0002" });
    await commit(olaId, "select public.family_remove_member('maz@example.com')");
    expect((await db.client.query("select 1 from profiles where email = 'maz@example.com'")).rows).toHaveLength(0);
  });
});

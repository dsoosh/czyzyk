import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, createAuthUser, createTestDb, user, type TestDb } from "./db.js";

// Family invites: Ola invites Marek, who already has his own family. Accepting moves Marek; when he
// was alone, his children and "done" marks follow and the old family disappears.
let db: TestDb;
let olaFamily: string;
let olaId: string;
let wilki: string;

beforeAll(async () => {
  db = await createTestDb();
  olaFamily = (await db.client.query("insert into families (name) values ('Rodzina Oli') returning id")).rows[0].id;
  await db.client.query("insert into allowed_emails (email, role, family_id) values ('ola@example.com', 'family', $1)", [olaFamily]);
  olaId = await createAuthUser(db.client, "ola@example.com", "Ola");
  wilki = (await db.client.query("insert into wa_groups (wa_name, tracked) values ('Wilki', true) returning id")).rows[0].id;
  await db.client.query("insert into children (family_id, name, group_id, color) values ($1, 'Zosia', $2, 'lime')", [olaFamily, wilki]);
});

afterAll(async () => {
  await db?.drop();
});

const rows = (actor: string, sql: string, params: unknown[] = []) =>
  as(db.client, user(actor), async (q) => (await q(sql, params)).rows);
const commit = (actor: string, sql: string, params: unknown[] = []) =>
  as(db.client, user(actor), async (q) => (await q(sql, params)).rows, { commit: true });

async function separateFamily(email: string, name: string) {
  const family = (await db.client.query("insert into families (name) values ($1) returning id", [`Rodzina ${name}`])).rows[0].id as string;
  await db.client.query("insert into allowed_emails (email, role, family_id) values ($1, 'family', $2)", [email, family]);
  const id = await createAuthUser(db.client, email, name);
  return { family, id };
}

const invite = async (email: string) => (await commit(olaId, "select public.family_add_member($1) as r", [email]))[0].r;
const myInvites = (actor: string) => rows(actor, "select id, family_name, invited_by_name from public.my_family_invites()");

describe("zaproszenia do rodziny", () => {
  it("osoba sama w rodzinie przechodzi z dziećmi i znacznikami, stara rodzina znika", async () => {
    const marek = await separateFamily("marek@example.com", "Marek");
    await db.client.query("insert into children (family_id, name, group_id, color) values ($1, 'Zosia', $2, 'sky'), ($1, 'Antek', $2, 'lime')", [
      marek.family,
      wilki,
    ]);
    const { rows: item } = await db.client.query("insert into bring_items (group_id, description) values ($1, 'kapcie') returning id", [wilki]);
    await db.client.query("insert into item_done (item_type, item_id, family_id) values ('bring_item', $1, $2)", [item[0].id, marek.family]);

    expect(await invite("Marek@Example.com")).toBe("invited");
    expect(await invite("marek@example.com")).toBe("invited");
    expect(await rows(olaId, "select email, invited from public.family_members() where invited")).toEqual([{ email: "marek@example.com", invited: true }]);
    const [inv] = await myInvites(marek.id);
    expect(inv).toMatchObject({ family_name: "Rodzina Oli", invited_by_name: "Ola" });
    // Only the invitee can answer.
    await expect(commit(olaId, "select public.accept_family_invite($1)", [inv.id])).rejects.toMatchObject({ code: "P0002" });

    await commit(marek.id, "select public.accept_family_invite($1)", [inv.id]);
    const { rows: kids } = await db.client.query("select name, color from children where family_id = $1 order by name", [olaFamily]);
    expect(kids).toEqual([
      { name: "Antek", color: null },
      { name: "Zosia", color: "lime" },
    ]);
    expect((await db.client.query("select 1 from families where id = $1", [marek.family])).rows).toHaveLength(0);
    expect((await db.client.query("select family_id from profiles where id = $1", [marek.id])).rows[0].family_id).toBe(olaFamily);
    expect((await db.client.query("select family_id from item_done where item_id = $1", [item[0].id])).rows).toEqual([{ family_id: olaFamily }]);
    expect(await myInvites(marek.id)).toEqual([]);
    expect((await rows(olaId, "select email from public.family_members() where not invited")).map((r) => r.email)).toEqual([
      "ola@example.com",
      "marek@example.com",
    ]);
  });

  it("gdy w starej rodzinie zostają inni, przechodzi tylko zaproszony", async () => {
    const babcia = await separateFamily("babcia@example.com", "Babcia");
    await db.client.query("insert into allowed_emails (email, role, family_id) values ('dziadek@example.com', 'family', $1)", [babcia.family]);
    await db.client.query("insert into children (family_id, name, group_id) values ($1, 'Kuba', $2)", [babcia.family, wilki]);
    await invite("babcia@example.com");
    const [inv] = await myInvites(babcia.id);
    await commit(babcia.id, "select public.accept_family_invite($1)", [inv.id]);
    expect((await db.client.query("select family_id from children where name = 'Kuba'")).rows).toEqual([{ family_id: babcia.family }]);
    expect((await db.client.query("select family_id from profiles where id = $1", [babcia.id])).rows[0].family_id).toBe(olaFamily);
  });

  it("odrzucenie i anulowanie usuwają zaproszenie", async () => {
    const wujek = await separateFamily("wujek@example.com", "Wujek");
    await invite("wujek@example.com");
    const [inv] = await myInvites(wujek.id);
    await commit(wujek.id, "select public.decline_family_invite($1)", [inv.id]);
    expect(await myInvites(wujek.id)).toEqual([]);
    expect((await db.client.query("select family_id from profiles where id = $1", [wujek.id])).rows[0].family_id).toBe(wujek.family);

    await invite("wujek@example.com");
    await commit(olaId, "select public.family_remove_member('wujek@example.com')");
    expect(await myInvites(wujek.id)).toEqual([]);
    expect((await db.client.query("select 1 from allowed_emails where email = 'wujek@example.com'")).rows).toHaveLength(1);
  });
});

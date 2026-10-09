import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { allowEmail, as, createAuthUser, createTestDb, user, type TestDb } from "./db.js";

let db: TestDb;
let olaId: string;
let adminId: string;

beforeAll(async () => {
  db = await createTestDb();
  await allowEmail(db.client, "ola@example.com", "family");
  olaId = await createAuthUser(db.client, "ola@example.com", "Ola");
  await allowEmail(db.client, "darek@example.com", "admin");
  adminId = await createAuthUser(db.client, "darek@example.com", "Darek");
});

afterAll(async () => {
  await db?.drop();
});

async function addEvent(title: string) {
  const { rows } = await db.client.query<{ id: string }>(
    "insert into events (title, starts_at, all_day) values ($1, '2026-10-15T06:00:00Z', false) returning id",
    [title],
  );
  const id = rows[0]!.id;
  await db.client.query("insert into item_changes (item_type, item_id, op) values ('event', $1, 'create')", [id]);
  await db.client.query("insert into bring_items (description, event_id) values ('kanapki', $1)", [id]);
  return id;
}

describe("usuwanie wydarzeń", () => {
  it("admin usuwa wydarzenie z historią; rzecz do przyniesienia zostaje bez wydarzenia", async () => {
    const id = await addEvent("Wycieczka 8:00");
    await as(db.client, user(adminId), (q) => q("select admin_delete_event($1)", [id]), { commit: true });
    expect((await db.client.query("select * from events where id = $1", [id])).rows).toEqual([]);
    expect((await db.client.query("select * from item_changes where item_id = $1", [id])).rows).toEqual([]);
    expect((await db.client.query("select event_id from bring_items where description = 'kanapki'")).rows).toEqual([{ event_id: null }]);
    await expect(as(db.client, user(adminId), (q) => q("select admin_delete_event($1)", [id]))).rejects.toThrow(/Nie ma takiego wydarzenia/);
  });

  it("członek rodziny bez roli admina nie usunie wydarzenia", async () => {
    const id = await addEvent("Wycieczka 9:00");
    await expect(as(db.client, user(olaId), (q) => q("select admin_delete_event($1)", [id]))).rejects.toThrow(/Brak uprawnień/);
    await expect(as(db.client, user(olaId), (q) => q("delete from events where id = $1", [id]))).rejects.toThrow(/permission denied/);
    expect((await db.client.query("select count(*)::int as n from events where id = $1", [id])).rows[0].n).toBe(1);
  });
});

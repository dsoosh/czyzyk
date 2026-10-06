import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "../../../../supabase/tests/db.js";
import { findDueGroups } from "./scheduler.js";

let db: TestDb;
let g1: string;
let g2: string;

beforeAll(async () => {
  db = await createTestDb();
  const { rows } = await db.client.query("insert into wa_groups (wa_name, tracked) values ('A', true), ('B', true) returning id");
  [g1, g2] = rows.map((r) => r.id);
});

afterAll(async () => {
  await db?.drop();
});

beforeEach(async () => {
  await db.client.query("delete from messages");
});

let n = 0;
async function receive(groupId: string, receivedAt: string, processed = false) {
  await db.client.query(
    `insert into messages (group_id, author, sent_at, text, source, dedupe_key, received_at, processed_at)
     values ($1, 'A', $2, 't', 'notification', $3, $2, $4)`,
    [groupId, receivedAt, `k${n++}`, processed ? receivedAt : null],
  );
}

const at = (hhmm: string) => new Date(`2026-10-07T${hhmm}:00+02:00`);

describe("findDueGroups (próg 1800 s)", () => {
  it("seria wiadomości jest gotowa dopiero 30 minut po ostatniej", async () => {
    await receive(g1, at("18:00").toISOString());
    await receive(g1, at("18:10").toISOString());
    await receive(g1, at("18:20").toISOString());

    expect(await findDueGroups(db.client, 1800, at("18:30"))).toEqual([]);
    expect(await findDueGroups(db.client, 1800, at("18:49"))).toEqual([]);
    expect(await findDueGroups(db.client, 1800, at("18:50"))).toEqual([g1]);
  });

  it("nowa wiadomość w oknie ciszy przesuwa termin", async () => {
    await receive(g1, at("18:00").toISOString());
    await receive(g1, at("18:25").toISOString());
    expect(await findDueGroups(db.client, 1800, at("18:31"))).toEqual([]);
    expect(await findDueGroups(db.client, 1800, at("18:55"))).toEqual([g1]);
  });

  it("liczy okno osobno dla każdej grupy i pomija przetworzone", async () => {
    await receive(g1, at("17:00").toISOString());
    await receive(g2, at("18:00").toISOString());
    await receive(g2, at("16:00").toISOString(), true);
    expect(await findDueGroups(db.client, 1800, at("18:10"))).toEqual([g1]);
    expect(await findDueGroups(db.client, 1800, at("18:40"))).toEqual([g1, g2]);
  });

  it("używa czasu przyjęcia, nie wysłania", async () => {
    await db.client.query(
      `insert into messages (group_id, author, sent_at, text, source, dedupe_key, received_at)
       values ($1, 'A', $2, 't', 'notification', 'late', $3)`,
      [g1, at("10:00"), at("18:00")],
    );
    expect(await findDueGroups(db.client, 1800, at("18:10"))).toEqual([]);
  });
});

import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./db.js";

let db: TestDb;
let listener: pg.Client;
const received: string[] = [];

beforeAll(async () => {
  db = await createTestDb();
  listener = new pg.Client({ connectionString: db.url });
  await listener.connect();
  listener.on("notification", (n) => n.channel === "message_ingested" && received.push(n.payload ?? ""));
  await listener.query("listen message_ingested");
});

afterAll(async () => {
  await listener?.end();
  await db?.drop();
});

async function settle() {
  await new Promise((r) => setTimeout(r, 300));
}

async function insertMessage(groupId: string, key: string, processed = false) {
  await db.client.query(
    `insert into messages (group_id, author, sent_at, text, source, dedupe_key, processed_at)
     values ($1, 'Pani Ania', now(), 'W piątek bal', 'notification', $2, case when $3 then now() end)`,
    [groupId, key, processed],
  );
}

describe("message_ingested", () => {
  it("wysyła jedno powiadomienie z identyfikatorem grupy na transakcję, bez treści", async () => {
    const { rows } = await db.client.query<{ id: string }>("insert into wa_groups (wa_name, tracked) values ('Motylki', true) returning id");
    const groupId = rows[0]!.id;
    received.length = 0;

    await db.client.query("begin");
    await insertMessage(groupId, "a");
    await insertMessage(groupId, "b");
    await insertMessage(groupId, "c");
    await db.client.query("commit");
    await settle();

    expect(received).toEqual([groupId]);
  });

  it("nie powiadamia o wiadomości już przetworzonej (historia z importu)", async () => {
    const { rows } = await db.client.query<{ id: string }>("insert into wa_groups (wa_name, tracked) values ('Biedronki', true) returning id");
    received.length = 0;
    await insertMessage(rows[0]!.id, "old", true);
    await settle();
    expect(received).toEqual([]);
  });

  it("funkcja triggera nie jest dostępna dla klientów", async () => {
    const { rows } = await db.client.query<{ anon: boolean; auth: boolean }>(
      `select has_function_privilege('anon', 'public.notify_message_ingested()', 'execute') as anon,
              has_function_privilege('authenticated', 'public.notify_message_ingested()', 'execute') as auth`,
    );
    expect(rows[0]).toEqual({ anon: false, auth: false });
  });
});

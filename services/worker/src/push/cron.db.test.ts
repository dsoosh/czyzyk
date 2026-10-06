import { PUSH_ALERT_QUEUE } from "@czyzyk/shared";
import pg from "pg";
import { PgBoss } from "pg-boss";
import { pino } from "pino";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { allowEmail, createAuthUser, createTestDb, type TestDb } from "../../../../supabase/tests/db.js";
import { handleAlert } from "./alerts.js";
import { registerPushJobs } from "./cron.js";
import { runDigest } from "./digest.js";
import type { DeliveryResult, PushPayload, PushSender, Subscription } from "./send.js";

let db: TestDb;
let pool: pg.Pool;
let olaId: string;
let darekId: string;
const logger = pino({ level: "silent" });

/** Push double: records deliveries; endpoints listed in `gone` answer like an expired subscription. */
function fakeSender(gone: string[] = []) {
  const sent: { endpoint: string; payload: PushPayload }[] = [];
  const sender: PushSender = {
    async send(subscription: Subscription, payload: PushPayload): Promise<DeliveryResult> {
      if (gone.includes(subscription.endpoint)) return "gone";
      sent.push({ endpoint: subscription.endpoint, payload });
      return "sent";
    },
  };
  return { sender, sent };
}

const at = (local: string) => new Date(`${local}+02:00`); // October: CEST

beforeAll(async () => {
  db = await createTestDb();
  pool = new pg.Pool({ connectionString: db.url, max: 3 });
  await allowEmail(db.client, "ola@example.com", "family");
  await allowEmail(db.client, "darek@example.com", "admin");
  olaId = await createAuthUser(db.client, "ola@example.com", "Ola");
  darekId = await createAuthUser(db.client, "darek@example.com", "Darek");
});

afterAll(async () => {
  await pool?.end();
  await db?.drop();
});

beforeEach(async () => {
  await db.client.query(
    "delete from bring_items; delete from payments; delete from events; delete from closures; delete from action_required; delete from push_alerts_sent; delete from push_subscriptions; delete from push_settings",
  );
  for (const [uid, n] of [
    [olaId, 1],
    [darekId, 2],
  ] as const) {
    await db.client.query("insert into push_settings (user_id) values ($1)", [uid]);
    await db.client.query("insert into push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, $2, 'p', 'a')", [
      uid,
      `https://push.example/${n}`,
    ]);
  }
});

const digest = (sender: PushSender, now: Date) => runDigest({ db: pool, sender, logger, windowMinutes: 120 }, now);

async function seedTomorrow() {
  await db.client.query("insert into bring_items (description, due_date) values ('strój sportowy', '2026-10-09')");
  await db.client.query("insert into payments (description, amount_pln, due_date) values ('10 zł na teatrzyk', 10, '2026-10-09')");
}

describe("Wieczorny skrót", () => {
  it("jutro strój i teatrzyk: o 19:00 „Jutro: strój sportowy, 10 zł na teatrzyk”, stuknięcie otwiera „/”", async () => {
    await seedTomorrow();
    const { sender, sent } = fakeSender();
    const result = await digest(sender, at("2026-10-08T19:00:00"));
    expect(result).toMatchObject({ claimed: 2, sent: 2 });
    expect(sent.map((s) => s.payload)).toEqual([
      { title: "Czyżyk", body: "Jutro: strój sportowy, 10 zł na teatrzyk", url: "/", tag: "digest-2026-10-09" },
      { title: "Czyżyk", body: "Jutro: strój sportowy, 10 zł na teatrzyk", url: "/", tag: "digest-2026-10-09" },
    ]);
  });

  it("najwyżej jeden skrót dziennie", async () => {
    await seedTomorrow();
    const { sender, sent } = fakeSender();
    await digest(sender, at("2026-10-08T19:00:00"));
    await digest(sender, at("2026-10-08T19:05:00"));
    await digest(sender, at("2026-10-08T20:00:00"));
    expect(sent).toHaveLength(2);
    await db.client.query("insert into bring_items (description, due_date) values ('kapcie', '2026-10-10')");
    await digest(sender, at("2026-10-09T19:00:00"));
    expect(sent).toHaveLength(4);
    expect(sent[3]!.payload.body).toBe("Jutro: kapcie");
  });

  it("godzina 20:30: nie o 19:00, tylko o 20:30", async () => {
    await seedTomorrow();
    await db.client.query("update push_settings set digest_time = '20:30' where user_id = $1", [olaId]);
    const { sender, sent } = fakeSender();
    await digest(sender, at("2026-10-08T18:55:00"));
    expect(sent).toHaveLength(0);
    await digest(sender, at("2026-10-08T19:00:00"));
    expect(sent.map((s) => s.endpoint)).toEqual(["https://push.example/2"]);
    await digest(sender, at("2026-10-08T20:30:00"));
    expect(sent.map((s) => s.endpoint)).toEqual(["https://push.example/2", "https://push.example/1"]);
  });

  it("pusty dzień: skrót nie jest wysyłany", async () => {
    await db.client.query("insert into bring_items (description, due_date, status) values ('niepewne', '2026-10-09', 'needs_review')");
    await db.client.query("insert into bring_items (description, due_date, packed_at) values ('spakowane', '2026-10-09', now())");
    await db.client.query("insert into payments (description, due_date, paid_at) values ('zapłacone', '2026-10-09', now())");
    const { sender, sent } = fakeSender();
    expect(await digest(sender, at("2026-10-08T19:00:00"))).toMatchObject({ claimed: 2, empty: true, sent: 0 });
    expect(sent).toHaveLength(0);
  });

  it("dzień wolny i wydarzenie z godziną w treści", async () => {
    await db.client.query("insert into closures (date_from, date_to, reason) values ('2026-10-09', '2026-10-09', 'dzień nauczyciela')");
    await db.client.query("insert into events (title, starts_at, all_day) values ('Teatrzyk', '2026-10-09 10:00+02', false)");
    const { sender, sent } = fakeSender();
    await digest(sender, at("2026-10-08T19:00:00"));
    expect(sent[0]!.payload.body).toBe("Jutro: przedszkole nieczynne (dzień nauczyciela), Teatrzyk 10:00");
  });

  it("wyłączony skrót, brak subskrypcji i spóźnienie ponad okno", async () => {
    await seedTomorrow();
    await db.client.query("update push_settings set digest_enabled = false where user_id = $1", [olaId]);
    await db.client.query("delete from push_subscriptions where user_id = $1", [darekId]);
    const { sender, sent } = fakeSender();
    await digest(sender, at("2026-10-08T19:00:00"));
    expect(sent).toHaveLength(0);
    await db.client.query("update push_settings set digest_enabled = true where user_id = $1", [olaId]);
    await digest(sender, at("2026-10-08T21:30:00"));
    expect(sent).toHaveLength(0);
  });

  it("wygasła subskrypcja (410) jest usuwana", async () => {
    await seedTomorrow();
    const { sender } = fakeSender(["https://push.example/1"]);
    expect(await digest(sender, at("2026-10-08T19:00:00"))).toMatchObject({ sent: 1, removed: 1 });
    const { rows } = await db.client.query("select endpoint from push_subscriptions");
    expect(rows).toEqual([{ endpoint: "https://push.example/2" }]);
  });
});

describe("Alerty natychmiastowe", () => {
  const now = at("2026-10-07T18:00:00");

  it("nowy dzień wolny: „Przedszkole nieczynne 12.10 (dzień nauczyciela)”, dwie ekstrakcje dają jeden alert", async () => {
    const { rows } = await db.client.query(
      "insert into closures (date_from, date_to, reason) values ('2026-10-12', '2026-10-12', 'dzień nauczyciela') returning id",
    );
    await db.client.query("update push_settings set alert_closures = false where user_id = $1", [darekId]);
    const { sender, sent } = fakeSender();
    const deps = { db: pool, sender, logger };
    await handleAlert(deps, { type: "closure", id: rows[0].id }, now);
    expect(await handleAlert(deps, { type: "closure", id: rows[0].id }, now)).toBe("skipped");
    expect(sent).toEqual([
      {
        endpoint: "https://push.example/1",
        payload: { title: "Czyżyk", body: "Przedszkole nieczynne 12.10 (dzień nauczyciela)", url: "/", tag: `closure-${rows[0].id}` },
      },
    ]);
  });

  it("zakres dni wolnych i sprawa „wymaga odpowiedzi”", async () => {
    const { rows: c } = await db.client.query(
      "insert into closures (date_from, date_to, reason) values ('2026-12-23', '2027-01-01', 'przerwa świąteczna') returning id",
    );
    const { rows: a } = await db.client.query(
      "insert into action_required (question, due_date) values ('Zgoda na wycieczkę', '2026-10-15') returning id",
    );
    const { sender, sent } = fakeSender();
    await handleAlert({ db: pool, sender, logger }, { type: "closure", id: c[0].id }, now);
    await handleAlert({ db: pool, sender, logger }, { type: "action_required", id: a[0].id }, now);
    expect(sent.map((s) => s.payload.body)).toEqual([
      "Przedszkole nieczynne 23.12–1.01 (przerwa świąteczna)",
      "Przedszkole nieczynne 23.12–1.01 (przerwa świąteczna)",
      "Wymaga odpowiedzi: Zgoda na wycieczkę (do 15.10)",
      "Wymaga odpowiedzi: Zgoda na wycieczkę (do 15.10)",
    ]);
  });

  it("płatność: alert tylko z terminem na jutro", async () => {
    const { rows } = await db.client.query(
      `insert into payments (description, amount_pln, due_date) values ('basen', 12, '2026-10-08'), ('wyprawka', 50, '2026-10-20')
       returning id, description`,
    );
    const { sender, sent } = fakeSender();
    for (const r of rows) await handleAlert({ db: pool, sender, logger }, { type: "payment", id: r.id }, now);
    expect(sent.map((s) => s.payload.body)).toEqual(["Płatność na jutro: basen (12 zł)", "Płatność na jutro: basen (12 zł)"]);
  });

  it("elementy needs_review i odwołane nie wywołują alertu", async () => {
    const { rows } = await db.client.query(
      `insert into closures (date_from, date_to, status) values ('2026-10-12', '2026-10-12', 'needs_review'), ('2026-10-13', '2026-10-13', 'cancelled')
       returning id`,
    );
    const { sender, sent } = fakeSender();
    for (const r of rows) expect(await handleAlert({ db: pool, sender, logger }, { type: "closure", id: r.id }, now)).toBe("skipped");
    expect(sent).toHaveLength(0);
    // A later approval can still alert: nothing was recorded for the skipped item.
    await db.client.query("update closures set status = 'active' where id = $1", [rows[0].id]);
    await handleAlert({ db: pool, sender, logger }, { type: "closure", id: rows[0].id }, now);
    expect(sent).toHaveLength(2);
  });
});

describe("registerPushJobs", () => {
  it("startuje kolejki, wykonuje skrót na żądanie i przetwarza zadania push-alert", async () => {
    await seedTomorrow();
    const { rows } = await db.client.query(
      "insert into closures (date_from, date_to, reason) values ('2026-10-12', '2026-10-12', 'dzień nauczyciela') returning id",
    );
    const { sender, sent } = fakeSender();
    const boss = new PgBoss({ connectionString: db.url, useListenNotify: true });
    await boss.start();
    const cron = await registerPushJobs(boss, pool, logger, {
      sender,
      digestWindowMinutes: 120,
      now: () => at("2026-10-08T19:00:00"),
      digestSchedule: null,
    });
    try {
      expect(await cron.digestNow()).toMatchObject({ sent: 2 });
      // The worker enqueues alerts with its own pg-boss instance.
      const producer = new PgBoss(db.url);
      await producer.start();
      await producer.send(PUSH_ALERT_QUEUE, { type: "closure", id: rows[0].id }, { singletonKey: `closure:${rows[0].id}` });
      await producer.stop({ graceful: false });
      for (let i = 0; i < 50 && sent.length < 4; i++) await new Promise((r) => setTimeout(r, 200));
      expect(sent.slice(2).map((s) => s.payload.body)).toEqual([
        "Przedszkole nieczynne 12.10 (dzień nauczyciela)",
        "Przedszkole nieczynne 12.10 (dzień nauczyciela)",
      ]);
    } finally {
      await boss.stop({ graceful: true, timeout: 10_000 });
    }
  });
});

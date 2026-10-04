/**
 * Stage 2 acceptance on a local database: a notification "W piątek bal, przebrania"
 * travels through the ingest API, waits out the quiet period, is extracted by the
 * worker (model double) and becomes visible to a family member through RLS.
 */
import { createHash, randomUUID } from "node:crypto";
import pg from "pg";
import { pino } from "pino";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../services/api/src/app.js";
import type { ExtractionModel } from "../../services/worker/src/extraction/model.js";
import type { ExtractionPrompt } from "../../services/worker/src/extraction/prompt.js";
import { startWorker, type RunningWorker } from "../../services/worker/src/worker.js";
import { allowEmail, as, createAuthUser, createTestDb, user, type TestDb } from "../../supabase/tests/db.js";

let db: TestDb;
let pool: pg.Pool;
let worker: RunningWorker;
let familyId: string;
const token = randomUUID().replaceAll("-", "").repeat(2);

/** Stands in for Claude: turns the newest message into the event and the bring item. */
const model: ExtractionModel = {
  async extract(p) {
    const prompt = p as ExtractionPrompt;
    const source = [...prompt.aliases.messages.keys()].at(-1)!;
    expect(prompt.user).toContain("W piątek bal, przebrania");
    return {
      operations: [
        {
          op: "create",
          type: "event",
          ref: "nowe1",
          data: { title: "Bal", start: "2026-10-09", end: null, all_day: true, location: null, whole_kindergarten: false },
          source_messages: [source],
          confidence: 0.95,
          rationale: "Nauczycielka zapowiada bal w piątek.",
        },
        {
          op: "create",
          type: "bring_item",
          ref: null,
          data: { description: "przebranie", due_date: "2026-10-09", event: "nowe1" },
          source_messages: [source],
          confidence: 0.9,
          rationale: "Na bal potrzebne są przebrania.",
        },
      ],
    };
  },
};

beforeAll(async () => {
  db = await createTestDb();
  pool = new pg.Pool({ connectionString: db.url, max: 3 });
  await allowEmail(db.client, "ola@example.com", "family");
  familyId = await createAuthUser(db.client, "ola@example.com");
  await db.client.query("insert into wa_groups (wa_name, display_name, tracked) values ('Motylki 2026/27', 'Motylki', true)");
  await db.client.query("insert into devices (name, token_hash) values ('Telefon', $1)", [
    createHash("sha256").update(token).digest("hex"),
  ]);
  worker = await startWorker(
    {
      DATABASE_URL: db.url,
      HEALTH_LOG_INTERVAL_SECONDS: 60,
      EXTRACTION_DEBOUNCE_MINUTES: 0.02, // ~1 s instead of 30 min
      EXTRACTION_CONFIDENCE_THRESHOLD: 0.7,
      EXTRACTION_CONTEXT_MESSAGES: 50,
    },
    pino({ level: "silent" }),
    { model, now: () => new Date(), scanSchedule: null },
  );
});

afterAll(async () => {
  await worker?.stop();
  await pool?.end();
  await db?.drop();
});

async function waitFor<T>(fn: () => Promise<T | undefined>, timeoutMs = 20_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await fn();
    if (value !== undefined) return value;
    if (Date.now() > deadline) throw new Error("timed out");
    await new Promise((r) => setTimeout(r, 200));
  }
}

describe("pierwszy przepływ danych", () => {
  it("„W piątek bal, przebrania” staje się wydarzeniem z rzeczą do przyniesienia", async () => {
    const api = buildApp(
      { NODE_ENV: "test", LOG_LEVEL: "info", INGEST_RATE_LIMIT_PER_IP: 100, INGEST_RATE_LIMIT_PER_TOKEN: 100 },
      { db: pool },
    );
    const res = await api.inject({
      method: "POST",
      url: "/ingest/notification",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        idempotency_key: randomUUID(),
        group_name: "Motylki 2026/27",
        author: "Pani Ania",
        text: "W piątek bal, przebrania",
        sent_at: "2026-10-07T18:02:00+02:00",
        has_attachment: false,
        wa_package: "com.whatsapp",
      },
    });
    expect(res.statusCode).toBe(201);
    await api.close();

    // Not yet: the group is still inside its quiet period.
    expect(await worker.scanNow()).toEqual([]);
    await new Promise((r) => setTimeout(r, 1500));
    expect(await worker.scanNow()).toHaveLength(1);

    const seen = await waitFor(async () => {
      const rows = await as(db.client, user(familyId), async (q) =>
        (
          await q(
            `select e.title, e.all_day, b.description, b.due_date::text as due_date, e.status
               from public.bring_items b join public.events e on e.id = b.event_id`,
          )
        ).rows,
      );
      return rows.length ? rows : undefined;
    });
    expect(seen).toEqual([{ title: "Bal", all_day: true, description: "przebranie", due_date: "2026-10-09", status: "active" }]);

    const { rows } = await db.client.query("select processed_at from messages");
    expect(rows[0].processed_at).not.toBeNull();
  });
});

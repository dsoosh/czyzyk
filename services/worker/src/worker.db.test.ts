import { pino } from "pino";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "../../../supabase/tests/db.js";
import { startWorker } from "./worker.js";

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await db?.drop();
});

const settings = (url: string) => ({
  DATABASE_URL: url,
  HEALTH_LOG_INTERVAL_SECONDS: 60,
  EXTRACTION_DEBOUNCE_MINUTES: 30,
  EXTRACTION_CONFIDENCE_THRESHOLD: 0.7,
  EXTRACTION_CONTEXT_MESSAGES: 50,
});

describe("startWorker", () => {
  it("starts the job queue on the database and stops gracefully", async () => {
    const worker = await startWorker(settings(db.url), pino({ level: "silent" }), {
      model: { extract: async () => ({ operations: [] }) },
    });
    expect(await worker.healthy()).toBe(true);
    const { rows } = await db.client.query("select 1 from information_schema.schemata where schema_name = 'pgboss'");
    expect(rows).toHaveLength(1);
    await worker.stop();
  });

  it("po ekstrakcji dnia wolnego wstawia jedno zadanie push-alert", async () => {
    const { rows: g } = await db.client.query("insert into wa_groups (wa_name, tracked) values ('Motylki', true) returning id");
    await db.client.query(
      `insert into messages (group_id, author, sent_at, text, source, dedupe_key, received_at)
       values ($1, 'Pani Ania', now() - interval '2 hours', 'x', 'notification', 'k1', now() - interval '2 hours')`,
      [g[0].id],
    );
    const worker = await startWorker(settings(db.url), pino({ level: "silent" }), {
      scanSchedule: null,
      model: {
        extract: async (prompt) => ({
          operations: [
            {
              op: "create",
              type: "closure",
              ref: null,
              data: { date_from: "2026-10-12", date_to: "2026-10-12", reason: "dzień nauczyciela" },
              source_messages: [[...(prompt as { aliases: { messages: Map<string, string> } }).aliases.messages.keys()][0]],
              confidence: 0.95,
              rationale: "Ogłoszenie.",
            },
          ],
        }),
      },
    });
    try {
      expect(await worker.scanNow()).toEqual([g[0].id]);
      let jobs: { data: { type: string; id: string } }[] = [];
      for (let i = 0; i < 50 && jobs.length === 0; i++) {
        await new Promise((r) => setTimeout(r, 200));
        ({ rows: jobs } = await db.client.query("select data from pgboss.job where name = 'push-alert'"));
      }
      const { rows: closures } = await db.client.query("select id from closures");
      expect(jobs).toEqual([{ data: { type: "closure", id: closures[0].id } }]);
    } finally {
      await worker.stop();
    }
  });
});

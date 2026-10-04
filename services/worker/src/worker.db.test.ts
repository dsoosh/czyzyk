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
});

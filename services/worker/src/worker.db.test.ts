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

describe("startWorker", () => {
  it("starts the job queue on the database and stops gracefully", async () => {
    const worker = await startWorker({ DATABASE_URL: db.url, HEALTH_LOG_INTERVAL_SECONDS: 60 }, pino({ level: "silent" }));
    expect(await worker.healthy()).toBe(true);
    const { rows } = await db.client.query("select 1 from information_schema.schemata where schema_name = 'pgboss'");
    expect(rows).toHaveLength(1);
    await worker.stop();
  });
});

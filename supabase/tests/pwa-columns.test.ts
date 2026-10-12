import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ACTION_COLUMNS, BRING_COLUMNS, CLOSURE_COLUMNS, EVENT_COLUMNS, ITEM_TABLES, PAYMENT_COLUMNS } from "../../apps/pwa/src/lib/items.js";
import { allowEmail, as, createAuthUser, createTestDb, user, type TestDb } from "./db.js";

// The PWA's column lists against the real schema: the fake Supabase in the PWA tests accepts any
// column, so a column missing from a table or view only failed in production.
let db: TestDb;
let id: string;

beforeAll(async () => {
  db = await createTestDb();
  await allowEmail(db.client, "ola@example.com", "family");
  id = await createAuthUser(db.client, "ola@example.com", "Ola");
});

afterAll(async () => {
  await db?.drop();
});

describe("kolumny czytane przez PWA", () => {
  it.each([
    ["events", EVENT_COLUMNS],
    [ITEM_TABLES.bring_item, BRING_COLUMNS],
    [ITEM_TABLES.payment, PAYMENT_COLUMNS],
    [ITEM_TABLES.action_required, ACTION_COLUMNS],
    ["closures", CLOSURE_COLUMNS],
  ])("%s", async (table, columns) => {
    await expect(as(db.client, user(id), (q) => q(`select ${columns} from public.${table} limit 1`))).resolves.toBeDefined();
  });
});

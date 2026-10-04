import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { allowEmail, as, createAuthUser, createTestDb, user, type TestDb } from "./db.js";

let db: TestDb;
let olaId: string;
let darekId: string;

beforeAll(async () => {
  db = await createTestDb();
  await allowEmail(db.client, "ola@example.com", "family");
  await allowEmail(db.client, "darek@example.com", "admin");
  olaId = await createAuthUser(db.client, "ola@example.com", "Ola");
  darekId = await createAuthUser(db.client, "darek@example.com", "Darek");
});

afterAll(async () => {
  await db?.drop();
});

const call = (actor: string, sql: string) => as(db.client, user(actor), async (q) => (await q(sql)).rows, { commit: true });

describe("create_ical_token / revoke_ical_token", () => {
  it("zwraca 256-bitowy token raz, zapisuje tylko hash, nowy unieważnia poprzedni", async () => {
    const [{ create_ical_token: first }] = await call(olaId, "select public.create_ical_token()");
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    const [{ create_ical_token: second }] = await call(olaId, "select public.create_ical_token()");
    expect(second).not.toBe(first);
    const { rows } = await db.client.query(
      "select token_hash, revoked_at is null as active from ical_tokens where user_id = $1 order by created_at, revoked_at nulls last",
      [olaId],
    );
    const hash = (t: string) => createHash("sha256").update(t).digest("hex");
    expect(rows).toEqual([
      { token_hash: hash(first), active: false },
      { token_hash: hash(second), active: true },
    ]);
    expect(JSON.stringify(rows)).not.toContain(second);
  });

  it("unieważnienie dotyczy tylko własnych linków", async () => {
    await call(olaId, "select public.create_ical_token()");
    await call(darekId, "select public.create_ical_token()");
    await call(olaId, "select public.revoke_ical_token()");
    const { rows } = await db.client.query("select user_id from ical_tokens where revoked_at is null");
    expect(rows).toEqual([{ user_id: darekId }]);
  });

  it("właściciel widzi tylko swoje linki", async () => {
    const rows = await call(olaId, "select user_id from ical_tokens");
    expect(rows.every((r) => r.user_id === olaId)).toBe(true);
  });

  it("osoba spoza rodziny nie dostaje tokenu", async () => {
    await expect(call("22222222-2222-2222-2222-222222222222", "select public.create_ical_token()")).rejects.toMatchObject({
      code: "42501",
    });
  });
});

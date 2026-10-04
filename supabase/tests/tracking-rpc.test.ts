import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { allowEmail, anon, as, createAuthUser, createTestDb, user, type TestDb } from "./db.js";

let db: TestDb;
let olaId: string;
let darekId: string;
const strangerId = "22222222-2222-2222-2222-222222222222";

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

const rpc = (actor: string, sql: string, params: unknown[] = []) =>
  as(db.client, user(actor), async (q) => (await q(sql, params)).rows, { commit: true });

const cases = [
  {
    fn: "mark_packed",
    table: "bring_items",
    by: "packed_by",
    at: "packed_at",
    insert: "insert into bring_items (description, due_date) values ('przebranie', '2026-10-08') returning *",
  },
  {
    fn: "mark_paid",
    table: "payments",
    by: "paid_by",
    at: "paid_at",
    insert: "insert into payments (description, amount_pln, due_date) values ('teatrzyk', 10, '2026-10-10') returning *",
  },
  {
    fn: "mark_resolved",
    table: "action_required",
    by: "resolved_by",
    at: "resolved_at",
    insert: "insert into action_required (question, due_date) values ('Zgoda na wycieczkę', '2026-10-15') returning *",
  },
] as const;

describe.each(cases)("$fn", ({ fn, table, by, at, insert }) => {
  it("zapisuje wykonawcę i czas, bez zmiany innych pól", async () => {
    const { rows } = await db.client.query(insert);
    const before = rows[0];
    const [after] = await rpc(olaId, `select * from public.${fn}($1, true)`, [before.id]);
    expect(after[by]).toBe(olaId);
    expect(after[at]).toBeInstanceOf(Date);
    const { [by]: _b, [at]: _a, updated_at: _u, ...restAfter } = after;
    const { [by]: _b2, [at]: _a2, updated_at: _u2, ...restBefore } = before;
    expect(restAfter).toEqual(restBefore);
  });

  it("wykonawcą jest zawsze wywołujący", async () => {
    const { rows } = await db.client.query(insert);
    await rpc(olaId, `select public.${fn}($1, true)`, [rows[0].id]);
    const [row] = await rpc(darekId, `select * from public.${fn}($1, true)`, [rows[0].id]);
    expect(row[by]).toBe(darekId);
  });

  it("cofnięcie czyści wykonawcę i czas", async () => {
    const { rows } = await db.client.query(insert);
    await rpc(olaId, `select public.${fn}($1, true)`, [rows[0].id]);
    const [row] = await rpc(darekId, `select * from public.${fn}($1, false)`, [rows[0].id]);
    expect(row[by]).toBeNull();
    expect(row[at]).toBeNull();
  });

  it("odrzuca osobę spoza rodziny i anonima", async () => {
    const { rows } = await db.client.query(insert);
    await expect(rpc(strangerId, `select public.${fn}($1, true)`, [rows[0].id])).rejects.toMatchObject({
      code: "42501",
    });
    await expect(
      as(db.client, anon, (q) => q(`select public.${fn}($1, true)`, [rows[0].id])),
    ).rejects.toMatchObject({ code: "42501" });
    const { rows: after } = await db.client.query(`select ${by} from ${table} where id = $1`, [rows[0].id]);
    expect(after[0][by]).toBeNull();
  });

  it("nie oznacza anulowanych ani nieistniejących", async () => {
    const { rows } = await db.client.query(insert);
    await db.client.query(`update ${table} set status = 'cancelled' where id = $1`, [rows[0].id]);
    await expect(rpc(olaId, `select public.${fn}($1, true)`, [rows[0].id])).rejects.toMatchObject({ code: "P0002" });
    await expect(
      rpc(olaId, `select public.${fn}($1, true)`, ["00000000-0000-0000-0000-000000000000"]),
    ).rejects.toMatchObject({ code: "P0002" });
  });

  it("członek rodziny nadal nie może pisać do tabeli bezpośrednio", async () => {
    const { rows } = await db.client.query(insert);
    await expect(
      rpc(olaId, `update ${table} set ${by} = $2 where id = $1`, [rows[0].id, olaId]),
    ).rejects.toMatchObject({ code: "42501" });
  });
});

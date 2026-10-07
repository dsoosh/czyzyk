import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { allowEmail, as, createAuthUser, createTestDb, user, type TestDb } from "./db.js";

let db: TestDb;
let olaId: string;
let groupId: string;
let childId: string;
const strangerId = "22222222-2222-2222-2222-222222222222";

beforeAll(async () => {
  db = await createTestDb();
  await allowEmail(db.client, "ola@example.com", "family");
  olaId = await createAuthUser(db.client, "ola@example.com", "Ola");
  groupId = (await db.client.query<{ id: string }>("insert into wa_groups (wa_name, tracked) values ('Sokoły', true) returning id")).rows[0]!.id;
  childId = (await db.client.query<{ id: string }>("insert into children (name, group_id) values ('Elena', $1) returning id", [groupId])).rows[0]!.id;
});

afterAll(async () => {
  await db?.drop();
});

const asOla = (sql: string, params: unknown[] = []) => as(db.client, user(olaId), async (q) => (await q(sql, params)).rows, { commit: true });

async function action(suggestions: unknown[], due: string | null = "2099-01-15") {
  const { rows } = await db.client.query<{ id: string }>(
    `insert into action_required (group_id, question, due_date, child_ids, suggested_actions, confidence)
     values ($1, 'Zakup i doniesienie sprayu przeciwko insektom', $2, $3, $4, 0.9) returning id`,
    [groupId, due, [childId], JSON.stringify(suggestions)],
  );
  return rows[0]!.id;
}

const s = (kind: string, label: string, extra: Record<string, unknown> = {}) => ({
  kind,
  label,
  description: null,
  due_date: null,
  amount_pln: null,
  ...extra,
});

describe("proponowane akcje", () => {
  it("„Do przyniesienia” tworzy rzecz z dziećmi, grupą i terminem, zamyka sprawę z adnotacją", async () => {
    const id = await action([s("bring", "Do przyniesienia", { description: "spray przeciwko insektom" }), s("done", "Zrobione")]);
    const [result] = await asOla("select apply_action_suggestion($1, 0) as r", [id]);
    expect(result.r.kind).toBe("bring");
    const { rows: bring } = await db.client.query("select *, to_char(due_date, 'YYYY-MM-DD') as due from bring_items where id = $1", [
      result.r.created_id,
    ]);
    expect(bring[0]).toMatchObject({ description: "spray przeciwko insektom", group_id: groupId, child_ids: [childId], status: "active" });
    expect(bring[0].due).toBe("2099-01-15");
    expect(result.r.due_date).toBe("2099-01-15");
    expect(bring[0].rationale).toBe("Z „Wymaga odpowiedzi”: Do przyniesienia");
    const { rows: closed } = await db.client.query("select resolved_by, resolution from action_required where id = $1", [id]);
    expect(closed[0]).toEqual({ resolved_by: olaId, resolution: "Do przyniesienia" });
    await expect(asOla("select apply_action_suggestion($1, 1)", [id])).rejects.toThrow(/Nie ma takiej otwartej sprawy/);
  });

  it("rzecz z minionym albo pustym terminem trafia na najbliższy dzień roboczy", async () => {
    const { rows: expected } = await db.client.query<{ d: string }>(
      `select to_char(d + case extract(isodow from d) when 5 then 3 when 6 then 2 else 1 end, 'YYYY-MM-DD') as d
         from (select (now() at time zone 'Europe/Warsaw')::date as d) t`,
    );
    for (const due of ["2020-01-01", null]) {
      const id = await action([s("bring", "Kupić i przynieść", { description: "repelent" })], due);
      const [result] = await asOla("select apply_action_suggestion($1, 0) as r", [id]);
      const { rows } = await db.client.query("select to_char(due_date, 'YYYY-MM-DD') as due from bring_items where id = $1", [result.r.created_id]);
      expect(rows[0].due).toBe(expected[0]!.d);
      expect(result.r.due_date).toBe(expected[0]!.d);
    }
  });

  it("odpowiedź zapisuje wybraną odpowiedź; cofnięcie czyści ją", async () => {
    const id = await action([s("answer", "Tak, zapisujemy"), s("answer", "Nie")]);
    await asOla("select apply_action_suggestion($1, 1)", [id]);
    expect((await db.client.query("select resolution from action_required where id = $1", [id])).rows[0].resolution).toBe("Nie");
    await asOla("select mark_resolved($1, false)", [id]);
    expect((await db.client.query("select resolved_at, resolution from action_required where id = $1", [id])).rows[0]).toEqual({
      resolved_at: null,
      resolution: null,
    });
  });

  it("płatność z kwotą i wydarzenie całodniowe w kalendarzu", async () => {
    const pay = await action([s("payment", "Do zapłaty", { description: "składka na teatrzyk", amount_pln: 15 })]);
    const [p] = await asOla("select apply_action_suggestion($1, 0) as r", [pay]);
    const { rows: payment } = await db.client.query("select description, amount_pln from payments where id = $1", [p.r.created_id]);
    expect(payment[0]).toEqual({ description: "składka na teatrzyk", amount_pln: "15.00" });

    const ev = await action([s("event", "Do kalendarza", { description: "Zajęcia szachowe", due_date: "2026-10-06" })], null);
    const [e] = await asOla("select apply_action_suggestion($1, 0) as r", [ev]);
    const { rows: event } = await db.client.query("select title, all_day, starts_at from events where id = $1", [e.r.created_id]);
    expect(event[0]).toMatchObject({ title: "Zajęcia szachowe", all_day: true });
    expect(event[0].starts_at.toISOString()).toBe("2026-10-05T22:00:00.000Z");
  });

  it("odrzuca nieistniejącą akcję, wydarzenie bez daty i osobę spoza rodziny", async () => {
    const id = await action([s("event", "Do kalendarza")], null);
    await expect(asOla("select apply_action_suggestion($1, 3)", [id])).rejects.toThrow(/Nie ma takiej akcji/);
    await expect(asOla("select apply_action_suggestion($1, 0)", [id])).rejects.toThrow(/nie ma daty/);
    await expect(as(db.client, user(strangerId), (q) => q("select apply_action_suggestion($1, 0)", [id]))).rejects.toThrow(/Brak uprawnień/);
  });

  it("baza nie przyjmie więcej niż 4 propozycji", async () => {
    await expect(action([1, 2, 3, 4, 5].map(() => s("done", "Zrobione")))).rejects.toThrow(/suggested_actions/);
  });
});

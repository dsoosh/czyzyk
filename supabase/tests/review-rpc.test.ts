import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { allowEmail, as, createAuthUser, createTestDb, user, type TestDb } from "./db.js";

let db: TestDb;
let adminId: string;
let familyId: string;
let groupId: string;
let messageId: string;

beforeAll(async () => {
  db = await createTestDb();
  await allowEmail(db.client, "darek@example.com", "admin");
  await allowEmail(db.client, "ola@example.com", "family");
  adminId = await createAuthUser(db.client, "darek@example.com", "Darek");
  familyId = await createAuthUser(db.client, "ola@example.com", "Ola");
  const { rows } = await db.client.query("insert into wa_groups (wa_name) values ('Motylki') returning id");
  groupId = rows[0].id;
  const { rows: m } = await db.client.query(
    `insert into messages (group_id, author, sent_at, text, source, dedupe_key)
     values ($1, 'Pani Ania', now(), 'x', 'notification', 'k1') returning id`,
    [groupId],
  );
  messageId = m[0].id;
});

afterAll(async () => {
  await db?.drop();
});

const call = (actor: string, sql: string, params: unknown[] = []) =>
  as(db.client, user(actor), async (q) => (await q(sql, params)).rows, { commit: true });

const review = (actor: string, kind: string, id: string, action: string, patch: unknown = null) =>
  call(actor, "select public.review_item($1, $2, $3, $4)", [kind, id, action, patch === null ? null : JSON.stringify(patch)]);

async function newEvent(status = "needs_review") {
  const { rows } = await db.client.query(
    `insert into events (group_id, title, starts_at, all_day, status, confidence, source_message_ids)
     values ($1, 'Teatrzyk', '2026-10-09 10:00+02', false, $2, 0.5, array[$3::uuid]) returning id`,
    [groupId, status, messageId],
  );
  return rows[0].id as string;
}

describe("review_queue", () => {
  it("admin widzi elementy needs_review z danymi w kształcie ekstrakcji", async () => {
    const id = await newEvent();
    await db.client.query("insert into payments (description, amount_pln, status, confidence) values ('basen', 12.5, 'needs_review', 0.4)");
    const rows = await call(adminId, "select * from review_queue order by kind");
    const event = rows.find((r) => r.id === id);
    expect(event).toMatchObject({
      kind: "event",
      data: { title: "Teatrzyk", start: "2026-10-09T10:00", end: null, all_day: false, whole_kindergarten: false },
    });
    expect(rows.find((r) => r.kind === "payment")?.data).toEqual({ description: "basen", amount_pln: 12.5, due_date: null });
  });

  it("członek rodziny nie widzi kolejki", async () => {
    await newEvent();
    expect(await call(familyId, "select * from review_queue")).toEqual([]);
  });
});

describe("review_item", () => {
  it("zatwierdzenie: status active, kto i kiedy", async () => {
    const id = await newEvent();
    await review(adminId, "event", id, "approve");
    const { rows } = await db.client.query("select status, reviewed_by, reviewed_at from events where id = $1", [id]);
    expect(rows[0]).toMatchObject({ status: "active", reviewed_by: adminId });
    expect(rows[0].reviewed_at).toBeInstanceOf(Date);
  });

  it("poprawa daty z 9.10 na 16.10 i zatwierdzenie", async () => {
    const id = await newEvent();
    await review(adminId, "event", id, "approve", { start: "2026-10-16T10:00", title: " Teatrzyk „Calineczka” " });
    const { rows } = await db.client.query(
      "select status, title, to_char(starts_at at time zone 'Europe/Warsaw', 'YYYY-MM-DD HH24:MI') as start from events where id = $1",
      [id],
    );
    expect(rows[0]).toEqual({ status: "active", title: "Teatrzyk „Calineczka”", start: "2026-10-16 10:00" });
  });

  it("poprawa na wydarzenie całodniowe całego przedszkola", async () => {
    const id = await newEvent();
    await review(adminId, "event", id, "approve", { all_day: true, start: "2026-10-16", whole_kindergarten: true });
    const { rows } = await db.client.query(
      "select all_day, group_id, starts_at = '2026-10-16 00:00+02'::timestamptz as midnight from events where id = $1",
      [id],
    );
    expect(rows[0]).toEqual({ all_day: true, group_id: null, midnight: true });
    await review(adminId, "event", id, "approve", { whole_kindergarten: false });
    const { rows: back } = await db.client.query("select group_id from events where id = $1", [id]);
    expect(back[0].group_id).toBe(groupId);
  });

  it("poprawa pozostałych typów", async () => {
    const { rows } = await db.client.query(
      "insert into payments (description, amount_pln, status) values ('basen', 12, 'needs_review') returning id",
    );
    await review(adminId, "payment", rows[0].id, "approve", { amount_pln: 15.5, due_date: "2026-10-20" });
    const { rows: p } = await db.client.query("select amount_pln, due_date::text from payments where id = $1", [rows[0].id]);
    expect(p[0]).toEqual({ amount_pln: "15.50", due_date: "2026-10-20" });
  });

  it("odrzucenie: status cancelled", async () => {
    const id = await newEvent();
    await review(adminId, "event", id, "reject");
    const { rows } = await db.client.query("select status, reviewed_by from events where id = $1", [id]);
    expect(rows[0]).toEqual({ status: "cancelled", reviewed_by: adminId });
  });

  it("niepoprawne poprawki są odrzucane bez zmian", async () => {
    const id = await newEvent();
    await expect(review(adminId, "event", id, "approve", { status: "active" })).rejects.toMatchObject({ code: "22023" });
    await expect(review(adminId, "event", id, "approve", { title: "  " })).rejects.toMatchObject({ code: "22023" });
    await expect(review(adminId, "event", id, "approve", { start: "jutro" })).rejects.toMatchObject({ code: "22007" });
    await expect(review(adminId, "event", id, "reject", { title: "X" })).rejects.toMatchObject({ code: "22023" });
    await expect(review(adminId, "nope", id, "approve")).rejects.toMatchObject({ code: "22023" });
    await expect(review(adminId, "event", "00000000-0000-0000-0000-000000000000", "approve")).rejects.toMatchObject({
      code: "P0002",
    });
    const { rows } = await db.client.query("select status, reviewed_at from events where id = $1", [id]);
    expect(rows[0]).toEqual({ status: "needs_review", reviewed_at: null });
  });

  it("członek rodziny i osoba spoza rodziny dostają błąd uprawnień", async () => {
    const id = await newEvent();
    await expect(review(familyId, "event", id, "approve")).rejects.toMatchObject({ code: "42501" });
    await expect(review("22222222-2222-2222-2222-222222222222", "event", id, "approve")).rejects.toMatchObject({
      code: "42501",
    });
  });

  it("propozycja: przyjęcie stosuje dane i dołącza wiadomości źródłowe, odrzucenie propozycji zostawia element", async () => {
    const { rows: m } = await db.client.query(
      `insert into messages (group_id, author, sent_at, text, source, dedupe_key)
       values ($1, 'Pani Ania', now(), 'y', 'notification', 'k-prop') returning id`,
      [groupId],
    );
    const id = await newEvent("active");
    const proposal = { op: "update", data: { start: "2026-10-23T10:00" }, confidence: 0.9, rationale: "r", source_message_ids: [m[0].id] };
    await db.client.query("update events set reviewed_at = now(), pending_patch = $2 where id = $1", [id, proposal]);

    await expect(review(adminId, "event", id, "dismiss")).resolves.toBeDefined();
    const { rows: kept } = await db.client.query("select pending_patch, starts_at = '2026-10-09 10:00+02'::timestamptz as same from events where id = $1", [id]);
    expect(kept[0]).toEqual({ pending_patch: null, same: true });
    await expect(review(adminId, "event", id, "dismiss")).rejects.toMatchObject({ code: "22023" });

    await db.client.query("update events set pending_patch = $2 where id = $1", [id, proposal]);
    await review(adminId, "event", id, "approve", proposal.data);
    const { rows } = await db.client.query(
      "select pending_patch, source_message_ids, to_char(starts_at at time zone 'Europe/Warsaw', 'DD.MM') as day from events where id = $1",
      [id],
    );
    expect(rows[0].pending_patch).toBeNull();
    expect(rows[0].day).toBe("23.10");
    expect(rows[0].source_message_ids).toEqual(expect.arrayContaining([messageId, m[0].id]));
  });
});

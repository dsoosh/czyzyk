import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { allowEmail, as, createAuthUser, createTestDb, user, type TestDb } from "../../../../supabase/tests/db.js";
import { buildApp } from "../app.js";

let db: TestDb;
let pool: pg.Pool;
let olaId: string;
let groupId: string;

const config = { NODE_ENV: "test", LOG_LEVEL: "info", INGEST_RATE_LIMIT_PER_IP: 1000, INGEST_RATE_LIMIT_PER_TOKEN: 1000 } as const;
const app = () => buildApp(config, { db: pool });

async function newToken(userId = olaId): Promise<string> {
  return as(db.client, user(userId), async (q) => (await q("select public.create_ical_token() as t")).rows[0].t, { commit: true });
}

beforeAll(async () => {
  db = await createTestDb();
  pool = new pg.Pool({ connectionString: db.url, max: 3 });
  await allowEmail(db.client, "ola@example.com", "family");
  olaId = await createAuthUser(db.client, "ola@example.com", "Ola");
  const { rows } = await db.client.query("insert into wa_groups (wa_name, display_name, shared) values ('Motylki 2026/27', 'Motylki', true) returning id");
  groupId = rows[0].id;
});

afterAll(async () => {
  await pool?.end();
  await db?.drop();
});

beforeEach(async () => {
  await db.client.query("delete from events; delete from closures; delete from messages");
});

describe("GET /ical/{token}.ics", () => {
  it("zwraca aktywne wydarzenia i dni wolne, bez needs_review, cancelled i treści wiadomości", async () => {
    const { rows: m } = await db.client.query(
      `insert into messages (group_id, author, sent_at, text, source, dedupe_key)
       values ($1, 'Pani Ania', now(), 'Tajna treść wiadomości', 'notification', 'k1') returning id`,
      [groupId],
    );
    const { rows: ev } = await db.client.query(
      `insert into events (group_id, title, starts_at, all_day, status, source_message_ids, rationale) values
         ($1, 'Bal jesienny', now() + interval '2 days', true, 'active', array[$2::uuid], 'Pani Ania napisała'),
         (null, 'Teatrzyk', date_trunc('day', now()) + interval '5 days 10 hours', false, 'active', '{}', null),
         ($1, 'Niepewne', now() + interval '3 days', true, 'needs_review', '{}', null),
         ($1, 'Odwołane', now() + interval '4 days', true, 'cancelled', '{}', null)
       returning id, title`,
      [groupId, m[0].id],
    );
    await db.client.query(
      "insert into closures (group_id, date_from, date_to, reason) values (null, current_date + 10, current_date + 12, 'przerwa')",
    );

    const token = await newToken();
    const res = await app().inject({ method: "GET", url: `/ical/${token}.ics` });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("text/calendar; charset=utf-8");
    expect(res.headers["cache-control"]).toBe("private, max-age=900");
    const body = res.body;
    expect(body).toContain("SUMMARY:Bal jesienny");
    expect(body).toContain("DESCRIPTION:Grupa: Motylki");
    expect(body).toContain("SUMMARY:Teatrzyk");
    expect(body).toMatch(/DTSTART;TZID=Europe\/Warsaw:\d{8}T\d{6}/);
    expect(body).toContain("SUMMARY:Przedszkole nieczynne: przerwa");
    expect(body).toContain(`UID:${ev.find((e) => e.title === "Bal jesienny")!.id}@czyzyk`);
    expect(body).not.toContain("Niepewne");
    expect(body).not.toContain("Odwołane");
    expect(body).not.toContain("Tajna treść");
    expect(body).not.toContain("Pani Ania");
    expect(body.match(/BEGIN:VEVENT/g)).toHaveLength(3);
  });

  it("tylko grupy rodziny właściciela linku: cudza grupa nie trafia do kalendarza", async () => {
    const { rows: f } = await db.client.query("insert into families (name) values ('Rodzina Kasi') returning id");
    await db.client.query("insert into allowed_emails (email, role, family_id) values ('kasia@example.com', 'family', $1)", [f[0].id]);
    const kasiaId = await createAuthUser(db.client, "kasia@example.com", "Kasia");
    const { rows: g } = await db.client.query("insert into wa_groups (wa_name, tracked) values ('Wilki', true) returning id");
    await db.client.query("insert into children (family_id, name, group_id) values ($1, 'Lena', $2)", [f[0].id, g[0].id]);
    await db.client.query(
      `insert into events (group_id, title, starts_at, all_day) values
         ($1, 'Wycieczka Wilków', now() + interval '2 days', true), ($2, 'Bal jesienny', now() + interval '2 days', true)`,
      [g[0].id, groupId],
    );
    const feed = async (userId: string) => (await app().inject({ method: "GET", url: `/ical/${await newToken(userId)}.ics` })).body;
    const ola = await feed(olaId);
    expect(ola).toContain("SUMMARY:Bal jesienny");
    expect(ola).not.toContain("Wycieczka Wilków");
    const kasia = await feed(kasiaId);
    expect(kasia).toContain("SUMMARY:Wycieczka Wilków");
    expect(kasia).toContain("SUMMARY:Bal jesienny");
  });

  it("stałe zajęcia: osobny wpis na każde wystąpienie w ciągu roku, bez dni wolnych", async () => {
    await db.client.query(
      `insert into events (group_id, title, starts_at, all_day, repeat_weekdays, repeat_until)
       values ($1, 'Basen', date_trunc('day', now() at time zone 'Europe/Warsaw') at time zone 'Europe/Warsaw' + interval '9 hours',
               false, '{1,2,3,4,5,6,7}', (now() at time zone 'Europe/Warsaw')::date + 4)`,
      [groupId],
    );
    await db.client.query("insert into closures (date_from, date_to) values ((now() at time zone 'Europe/Warsaw')::date + 2, (now() at time zone 'Europe/Warsaw')::date + 2)");
    const token = await newToken();
    const { body } = await app().inject({ method: "GET", url: `/ical/${token}.ics` });
    expect(body.match(/SUMMARY:Basen/g)).toHaveLength(4);
    expect(body.match(/UID:[0-9a-f-]+-\d{8}@czyzyk/g)).toHaveLength(4);
  });

  it("dzień wolny kończy się dzień po ostatnim dniu (DTEND wyłączny)", async () => {
    await db.client.query("insert into closures (date_from, date_to, reason) values ('2026-12-23', '2027-01-01', 'przerwa świąteczna')");
    const token = await newToken();
    const { body } = await app().inject({ method: "GET", url: `/ical/${token}.ics` });
    expect(body).toContain("DTSTART;VALUE=DATE:20261223\r\nDTEND;VALUE=DATE:20270102");
  });

  it("404 dla nieznanego, niepoprawnego i unieważnionego tokenu", async () => {
    const a = app();
    expect((await a.inject({ method: "GET", url: `/ical/${"0".repeat(64)}.ics` })).statusCode).toBe(404);
    expect((await a.inject({ method: "GET", url: "/ical/abc.ics" })).statusCode).toBe(404);
    const old = await newToken();
    const fresh = await newToken();
    expect((await a.inject({ method: "GET", url: `/ical/${old}.ics` })).statusCode).toBe(404);
    expect((await a.inject({ method: "GET", url: `/ical/${fresh}.ics` })).statusCode).toBe(200);
    await as(db.client, user(olaId), (q) => q("select public.revoke_ical_token()"), { commit: true });
    expect((await a.inject({ method: "GET", url: `/ical/${fresh}.ics` })).statusCode).toBe(404);
  });

  it("404 po usunięciu osoby z listy dozwolonych", async () => {
    await allowEmail(db.client, "babcia@example.com", "family");
    const babciaId = await createAuthUser(db.client, "babcia@example.com", "Babcia");
    const token = await newToken(babciaId);
    expect((await app().inject({ method: "GET", url: `/ical/${token}.ics` })).statusCode).toBe(200);
    await db.client.query("delete from allowed_emails where email = 'babcia@example.com'");
    expect((await app().inject({ method: "GET", url: `/ical/${token}.ics` })).statusCode).toBe(404);
  });
});

import { randomUUID } from "node:crypto";
import { Writable } from "node:stream";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "../../../../supabase/tests/db.js";
import { buildApp } from "../app.js";

let db: TestDb;
let pool: pg.Pool;
let token: string;
let deviceId: string;
let logs: string[];

const config = { NODE_ENV: "test", LOG_LEVEL: "info", INGEST_RATE_LIMIT_PER_IP: 1000, INGEST_RATE_LIMIT_PER_TOKEN: 1000 } as const;

function app(overrides: Partial<typeof config> = {}) {
  logs = [];
  const logStream = new Writable({
    write(chunk, _enc, cb) {
      logs.push(String(chunk));
      cb();
    },
  });
  return buildApp({ ...config, ...overrides }, { db: pool, logStream });
}

async function newDevice(name = "Telefon") {
  const t = randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "");
  const { rows } = await db.client.query(
    "insert into devices (name, token_hash) values ($1, encode(extensions.digest($2, 'sha256'), 'hex')) returning id",
    [name, t],
  );
  return { token: t, id: rows[0].id as string };
}

const message = (overrides: Record<string, unknown> = {}) => ({
  idempotency_key: randomUUID(),
  group_name: "Motylki 2026/27",
  author: "Pani Ania",
  text: "W piątek bal, przebrania",
  sent_at: "2026-10-07T18:02:11+02:00",
  has_attachment: false,
  wa_package: "com.whatsapp",
  ...overrides,
});

beforeAll(async () => {
  db = await createTestDb();
  pool = new pg.Pool({ connectionString: db.url, max: 3 });
  ({ token, id: deviceId } = await newDevice());
});

afterAll(async () => {
  await pool?.end();
  await db?.drop();
});

beforeEach(async () => {
  await db.client.query("delete from messages");
  await db.client.query("delete from wa_groups");
  await db.client.query("insert into wa_groups (wa_name, tracked) values ('Motylki 2026/27', true), ('Sąsiedzi', false)");
});

const auth = (t = token) => ({ authorization: `Bearer ${t}` });

describe("uwierzytelnianie urządzenia", () => {
  it("401 bez tokenu i z niepoprawnym tokenem", async () => {
    const a = app();
    expect((await a.inject({ method: "GET", url: "/ingest/config" })).statusCode).toBe(401);
    expect((await a.inject({ method: "GET", url: "/ingest/config", headers: auth("0".repeat(64)) })).statusCode).toBe(401);
    expect((await a.inject({ method: "GET", url: "/ingest/config", headers: { authorization: "Bearer abc" } })).statusCode).toBe(401);
  });

  it("401 po unieważnieniu urządzenia", async () => {
    const d = await newDevice("Do unieważnienia");
    const a = app();
    expect((await a.inject({ method: "GET", url: "/ingest/config", headers: auth(d.token) })).statusCode).toBe(200);
    await db.client.query("update devices set revoked_at = now() where id = $1", [d.id]);
    expect((await a.inject({ method: "GET", url: "/ingest/config", headers: auth(d.token) })).statusCode).toBe(401);
  });

  it("zapisuje ostatni kontakt urządzenia", async () => {
    await db.client.query("update devices set last_seen_at = null where id = $1", [deviceId]);
    await app().inject({ method: "GET", url: "/ingest/config", headers: auth() });
    const { rows } = await db.client.query("select last_seen_at from devices where id = $1", [deviceId]);
    expect(Date.now() - new Date(rows[0].last_seen_at).getTime()).toBeLessThan(10_000);
  });

  it("429 po przekroczeniu limitu na token", async () => {
    const a = app({ INGEST_RATE_LIMIT_PER_TOKEN: 2 });
    const codes = [];
    for (let i = 0; i < 3; i++) codes.push((await a.inject({ method: "GET", url: "/ingest/config", headers: auth() })).statusCode);
    expect(codes).toEqual([200, 200, 429]);
  });

  it("429 po przekroczeniu limitu na IP, także bez tokenu", async () => {
    const a = app({ INGEST_RATE_LIMIT_PER_IP: 2 });
    const codes = [];
    for (let i = 0; i < 3; i++) codes.push((await a.inject({ method: "GET", url: "/ingest/config" })).statusCode);
    expect(codes).toEqual([401, 401, 429]);
  });

  it("sesja PWA (JWT) nie daje dostępu", async () => {
    const res = await app().inject({ method: "GET", url: "/ingest/config", headers: { authorization: "Bearer eyJhbGciOi.x.y" } });
    expect(res.statusCode).toBe(401);
  });
});

describe("GET /ingest/config i POST /ingest/seen-groups", () => {
  it("zwraca tylko śledzone grupy", async () => {
    const res = await app().inject({ method: "GET", url: "/ingest/config", headers: auth() });
    expect(res.json()).toEqual({ tracked_groups: ["Motylki 2026/27"], config_ttl_seconds: 900 });
  });

  it("dodaje nowe grupy jako nieśledzone, bez wiadomości", async () => {
    const res = await app().inject({
      method: "POST",
      url: "/ingest/seen-groups",
      headers: auth(),
      payload: { names: ["Motylki 2026/27", "Biedronki", "Biedronki"] },
    });
    expect(res.json()).toEqual({ received: 2, new_groups: 1 });
    const { rows } = await db.client.query("select tracked from wa_groups where wa_name = 'Biedronki'");
    expect(rows).toEqual([{ tracked: false }]);
    expect((await db.client.query("select count(*)::int as n from messages")).rows[0].n).toBe(0);
  });

  it("400 dla pustej listy", async () => {
    const res = await app().inject({ method: "POST", url: "/ingest/seen-groups", headers: auth(), payload: { names: [] } });
    expect(res.statusCode).toBe(400);
  });
});

describe("POST /ingest/notification", () => {
  const post = (a: ReturnType<typeof app>, payload: unknown) =>
    a.inject({ method: "POST", url: "/ingest/notification", headers: auth(), payload: payload as object });

  it("201 i zapis wiadomości ze źródłem notification", async () => {
    const res = await post(app(), message());
    expect(res.statusCode).toBe(201);
    const { rows } = await db.client.query("select * from messages where id = $1", [res.json().id]);
    expect(rows[0]).toMatchObject({
      author: "Pani Ania",
      text: "W piątek bal, przebrania",
      source: "notification",
      status: "active",
      processed_at: null,
    });
    expect(new Date(rows[0].sent_at).toISOString()).toBe("2026-10-07T16:02:11.000Z");
  });

  it("nazwa z niewidocznymi znakami trafia do istniejącej śledzonej grupy", async () => {
    const before = (await db.client.query("select count(*)::int as n from wa_groups")).rows[0].n;
    const res = await post(app(), { ...message(), idempotency_key: randomUUID(), text: "inna", group_name: "\u2068Motylki 2026/27\u2069" });
    expect(res.statusCode).toBe(201);
    expect((await db.client.query("select count(*)::int as n from wa_groups")).rows[0].n).toBe(before);
  });

  it("200 dla tego samego klucza idempotencji", async () => {
    const a = app();
    const m = message();
    const first = await post(a, m);
    const second = await post(a, m);
    expect(second.statusCode).toBe(200);
    expect(second.json()).toEqual({ id: first.json().id, duplicate: true });
  });

  it("200 dla tej samej wiadomości z innym kluczem, innymi białymi znakami, w tej samej minucie", async () => {
    const a = app();
    const first = await post(a, message());
    const second = await post(a, message({ text: "W piątek  bal,\nprzebrania ", sent_at: "2026-10-07T18:02:58+02:00" }));
    expect(second.statusCode).toBe(200);
    expect(second.json().id).toBe(first.json().id);
    expect((await db.client.query("select count(*)::int as n from messages")).rows[0].n).toBe(1);
  });

  it("422 dla grupy nieśledzonej i nieznanej, bez zapisu treści", async () => {
    const a = app();
    expect((await post(a, message({ group_name: "Sąsiedzi" }))).statusCode).toBe(422);
    expect((await post(a, message({ group_name: "Nowa grupa" }))).statusCode).toBe(422);
    expect((await db.client.query("select count(*)::int as n from messages")).rows[0].n).toBe(0);
    const { rows } = await db.client.query("select tracked from wa_groups where wa_name = 'Nowa grupa'");
    expect(rows).toEqual([{ tracked: false }]);
  });

  it("400 z nazwami błędnych pól i bez zapisu", async () => {
    const res = await post(app(), message({ author: "", sent_at: "wczoraj" }));
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "invalid_request", fields: ["author", "sent_at"] });
    expect((await db.client.query("select count(*)::int as n from messages")).rows[0].n).toBe(0);
  });

  it("aktualizuje czas ostatniego powiadomienia grupy", async () => {
    await post(app(), message());
    const { rows } = await db.client.query("select last_notification_at from wa_groups where wa_name = 'Motylki 2026/27'");
    expect(Date.now() - new Date(rows[0].last_notification_at).getTime()).toBeLessThan(10_000);
  });

  it("nie zapisuje w logach treści ani autora", async () => {
    const a = app();
    await post(a, message({ text: "Sekretna treść wiadomości", author: "Joanna Kowalska" }));
    await post(a, message({ text: "Sekretna treść wiadomości", author: "Joanna Kowalska" }));
    await post(a, message({ author: "", text: "Sekretna treść 400" }));
    const all = logs.join("");
    expect(all).toContain("message ingested");
    expect(all).not.toMatch(/Sekretna|Joanna|Kowalska|Bearer|[0-9a-f]{64}/);
  });
});

describe("POST /ingest/document", () => {
  const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]).toString("base64");
  const doc = (key: string, overrides: Record<string, unknown> = {}) => ({
    idempotency_key: key,
    file_name: "IMG-20261007-WA0003.jpg",
    screening: "image",
    text: "Jadłospis na październik",
    image: JPEG,
    ...overrides,
  });

  async function photoMessage() {
    const m = message({ text: "📷 Zdjęcie", has_attachment: true });
    await app().inject({ method: "POST", url: "/ingest/notification", headers: auth(), payload: m });
    return m.idempotency_key;
  }

  it("dołącza dokument do wiadomości; obraz czeka na kontrolę serwera, wiadomość wraca do analizy", async () => {
    const key = await photoMessage();
    await db.client.query("update messages set processed_at = now()");
    const res = await app().inject({ method: "POST", url: "/ingest/document", headers: auth(), payload: doc(key) });
    expect(res.statusCode).toBe(201);
    const { rows } = await db.client.query(
      `select a.file_name, a.screening, a.doc_text, a.doc_status, length(a.sha256) as sha, octet_length(f.bytes) as bytes,
              m.processed_at is null as pending
         from attachments a join messages m on m.id = a.message_id left join attachment_files f on f.attachment_id = a.id`,
    );
    expect(rows).toEqual([
      { file_name: "IMG-20261007-WA0003.jpg", screening: "image", doc_text: "Jadłospis na październik", doc_status: "pending", sha: 64, bytes: 8, pending: true },
    ]);
    // The same photo again (also under another name) is a duplicate.
    expect((await app().inject({ method: "POST", url: "/ingest/document", headers: auth(), payload: doc(key) })).json()).toEqual({ duplicate: true });
    expect(
      (await app().inject({ method: "POST", url: "/ingest/document", headers: auth(), payload: doc(key, { file_name: "kopia.jpg" }) })).statusCode,
    ).toBe(200);
  });

  it("sam tekst z telefonu jest od razu gotowy, bez obrazu", async () => {
    const key = await photoMessage();
    const res = await app().inject({
      method: "POST",
      url: "/ingest/document",
      headers: auth(),
      payload: doc(key, { screening: "text_only", image: undefined, text: "Bal jesienny 24.10" }),
    });
    expect(res.statusCode).toBe(201);
    expect((await db.client.query("select doc_status, screening from attachments")).rows).toEqual([{ doc_status: "ready", screening: "text_only" }]);
    expect((await db.client.query("select count(*)::int as n from attachment_files")).rows[0].n).toBe(0);
  });

  it("404 dla nieznanej wiadomości, 400 dla obrazu innego niż JPEG i niespójnych danych, 401 bez tokenu", async () => {
    const key = await photoMessage();
    const post = (payload: unknown, headers = auth()) => app().inject({ method: "POST", url: "/ingest/document", headers, payload: payload as object });
    expect((await post(doc(randomUUID()))).statusCode).toBe(404);
    expect((await post(doc(key, { image: Buffer.from("<svg/>").toString("base64") }))).statusCode).toBe(400);
    expect((await post(doc(key, { screening: "withheld" }))).statusCode).toBe(400);
    expect((await post(doc(key, { screening: "text_only" }))).statusCode).toBe(400);
    expect((await post(doc(key, { file_name: "../x.jpg" }))).statusCode).toBe(400);
    expect((await post(doc(key), {})).statusCode).toBe(401);
    expect((await db.client.query("select count(*)::int as n from attachments")).rows[0].n).toBe(0);
  });

  it("logi i dziennik bez treści dokumentu", async () => {
    const key = await photoMessage();
    await app().inject({ method: "POST", url: "/ingest/document", headers: auth(), payload: doc(key) });
    const { rows } = await db.client.query("select details from sync_log where kind = 'document'");
    expect(rows[0].details).toMatchObject({ screening: "image", bytes: 8 });
    expect(JSON.stringify(rows) + logs.join("")).not.toMatch(/Jadłospis|IMG-2026|\/9j/);
  });
});

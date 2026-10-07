import { dedupeKey } from "@czyzyk/shared";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type CryptoKey } from "jose";
import { Writable } from "node:stream";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { allowEmail, createAuthUser, createTestDb, type TestDb } from "../../../../supabase/tests/db.js";
import { buildApp } from "../app.js";
import { createSessionVerifier } from "../push/session.js";

const SUPABASE_URL = "https://test-project.supabase.co";
const NOW = Date.parse("2026-10-20T12:00:00Z");

let db: TestDb;
let pool: pg.Pool;
let adminId: string;
let familyId: string;
let groupId: string;
let key: CryptoKey;
let verify: ReturnType<typeof createSessionVerifier>;
let logs: string[];

const config = { NODE_ENV: "test", LOG_LEVEL: "info", INGEST_RATE_LIMIT_PER_IP: 1000, INGEST_RATE_LIMIT_PER_TOKEN: 1000 } as const;

function app() {
  logs = [];
  const logStream = new Writable({
    write(chunk, _enc, cb) {
      logs.push(String(chunk));
      cb();
    },
  });
  return buildApp(config, { db: pool, verifySession: verify, now: () => NOW, logStream });
}

const jwt = (sub: string) =>
  new SignJWT({}).setProtectedHeader({ alg: "ES256", kid: "k" }).setSubject(sub).setIssuer(`${SUPABASE_URL}/auth/v1`)
    .setAudience("authenticated").setIssuedAt().setExpirationTime("1h").sign(key);

const EXPORT = [
  "07.10.2026, 09:00 - Wiadomości i połączenia są szyfrowane end-to-end.",
  "01.09.2026, 10:00 - Pani Ania: Witamy w nowym roku przedszkolnym",
  "07.10.2026, 18:02 - Pani Ania: W piątek bal jesienny!",
  "Prosimy o przebrania.",
  "07.10.2026, 18:05 - Mama Zosi: IMG-20261007-WA0003.jpg (plik załączony)",
  "Plan na październik",
].join("\n");

async function post(body: unknown, sub: string | null = adminId, url = "/import/chat") {
  return app().inject({
    method: "POST",
    url,
    payload: body as object,
    headers: sub ? { authorization: `Bearer ${await jwt(sub)}` } : {},
  });
}

beforeAll(async () => {
  db = await createTestDb();
  pool = new pg.Pool({ connectionString: db.url, max: 3 });
  await allowEmail(db.client, "darek@example.com", "admin");
  await allowEmail(db.client, "ola@example.com", "family");
  adminId = await createAuthUser(db.client, "darek@example.com", "Darek");
  familyId = await createAuthUser(db.client, "ola@example.com", "Ola");
  const pair = await generateKeyPair("ES256");
  key = pair.privateKey;
  verify = createSessionVerifier({
    supabaseUrl: SUPABASE_URL,
    keys: createLocalJWKSet({ keys: [{ ...(await exportJWK(pair.publicKey)), kid: "k", alg: "ES256" }] }),
  });
});

afterAll(async () => {
  await pool?.end();
  await db?.drop();
});

beforeEach(async () => {
  await db.client.query("delete from messages; delete from sync_log; delete from wa_groups");
  const { rows } = await db.client.query("insert into wa_groups (wa_name, tracked) values ('Motylki 2026/27', true) returning id");
  groupId = rows[0].id;
});

describe("POST /import/chat", () => {
  it("importuje wiadomości jako export, starsze niż okres ekstrakcji jako przetworzone", async () => {
    const res = await post({ group_id: groupId, text: EXPORT, extract_days: 30 });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ messages: 3, inserted: 3, duplicates: 0, for_extraction: 2, skipped_lines: 1 });
    const { rows } = await db.client.query(
      "select author, text, source, has_attachment, processed_at is null as pending from messages order by sent_at",
    );
    expect(rows).toEqual([
      { author: "Pani Ania", text: "Witamy w nowym roku przedszkolnym", source: "export", has_attachment: false, pending: false },
      { author: "Pani Ania", text: "W piątek bal jesienny!\nProsimy o przebrania.", source: "export", has_attachment: false, pending: true },
      { author: "Mama Zosi", text: "Plan na październik", source: "export", has_attachment: true, pending: true },
    ]);
    const { rows: g } = await db.client.query("select last_export_at is not null as exported from wa_groups");
    expect(g[0].exported).toBe(true);
  });

  it("ponowny import i wiadomość znana z powiadomienia nie tworzą duplikatów", async () => {
    const sentAt = new Date("2026-10-07T16:02:37Z"); // the notification has seconds, the export does not
    const text = "W piątek bal jesienny!\nProsimy o przebrania.";
    await db.client.query(
      `insert into messages (group_id, author, sent_at, text, source, dedupe_key) values ($1, 'Pani Ania', $2, $3, 'notification', $4)`,
      [groupId, sentAt, text, dedupeKey({ groupId, author: "Pani Ania", sentAt, text })],
    );
    expect((await post({ group_id: groupId, text: EXPORT, extract_days: 30 })).json()).toMatchObject({ inserted: 2, duplicates: 1 });
    expect((await post({ group_id: groupId, text: EXPORT, extract_days: 30 })).json()).toMatchObject({ inserted: 0, duplicates: 3 });
    expect((await db.client.query("select count(*)::int as n from messages")).rows[0].n).toBe(3);
  });

  it("dziennik i logi zawierają liczby, bez treści i autorów", async () => {
    await post({ group_id: groupId, text: EXPORT, extract_days: 30 });
    const { rows } = await db.client.query("select kind, status, details from sync_log");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "export", status: "ok", details: { inserted: 3, origin: "pwa" } });
    const all = JSON.stringify(rows) + logs.join("");
    for (const secret of ["bal jesienny", "Pani Ania", "Mama Zosi", "przebrania"]) expect(all).not.toContain(secret);
  });

  it("401 bez sesji, 403 dla członka rodziny i osoby spoza rodziny", async () => {
    const body = { group_id: groupId, text: EXPORT, extract_days: 30 };
    expect((await post(body, null)).statusCode).toBe(401);
    expect((await post(body, familyId)).statusCode).toBe(403);
    expect((await post(body, "22222222-2222-2222-2222-222222222222")).statusCode).toBe(403);
    expect((await db.client.query("select count(*)::int as n from messages")).rows[0].n).toBe(0);
  });

  it("odrzuca nieśledzoną grupę, plik bez wiadomości i złe dane", async () => {
    await db.client.query("update wa_groups set tracked = false");
    expect((await post({ group_id: groupId, text: EXPORT, extract_days: 30 })).statusCode).toBe(422);
    await db.client.query("update wa_groups set tracked = true");
    expect((await post({ group_id: groupId, text: "to nie jest eksport", extract_days: 30 })).json()).toEqual({ error: "no_messages" });
    expect((await post({ group_id: "x", text: EXPORT, extract_days: 30 })).statusCode).toBe(400);
    expect((await post({ group_id: groupId, text: EXPORT, extract_days: 30, media: "zdjęcie" })).statusCode).toBe(400);
  });

  it("przyjmuje duży plik (ponad domyślny limit treści API)", async () => {
    const lines = Array.from({ length: 6000 }, (_, i) => `0${1 + (i % 9)}.08.2026, 10:${String(i % 60).padStart(2, "0")} - Rodzic ${i}: wiadomość numer ${i} ${"x".repeat(40)}`);
    const res = await post({ group_id: groupId, text: lines.join("\n"), extract_days: 0 });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ messages: 6000, inserted: 6000, for_extraction: 0 });
  });
});

describe("POST /import/message", () => {
  const paste = (body: unknown, sub: string | null = adminId) => post(body, sub, "/import/message");

  it("pojedyncza wiadomość: autor i czas z formularza, od razu do analizy", async () => {
    const res = await paste({ group_id: groupId, text: "  Jutro zbiórka o 8:00  ", author: "Pani Ania", sent_at: "2026-10-20T13:30:00+02:00" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ messages: 1, inserted: 1, duplicates: 0 });
    const { rows } = await db.client.query(
      "select author, sent_at, text, source, processed_at is null as pending, received_at < now() - interval '1 hour' as due from messages",
    );
    expect(rows).toEqual([
      { author: "Pani Ania", sent_at: new Date("2026-10-20T11:30:00Z"), text: "Jutro zbiórka o 8:00", source: "manual", pending: true, due: true },
    ]);
  });

  it("bez autora i czasu: nieznany nadawca, teraz", async () => {
    await paste({ group_id: groupId, text: "Zebranie w czwartek" });
    const { rows } = await db.client.query("select author, sent_at from messages");
    expect(rows).toEqual([{ author: "Nieznany nadawca", sent_at: new Date(NOW) }]);
  });

  it("skopiowane wiadomości z nagłówkami: autorzy i czasy z tekstu, bez duplikatu z powiadomienia", async () => {
    const sentAt = new Date("2026-10-07T16:02:00Z");
    await db.client.query(
      `insert into messages (group_id, author, sent_at, text, source, dedupe_key) values ($1, 'Pani Ania', $2, 'W piątek bal', 'notification', $3)`,
      [groupId, sentAt, dedupeKey({ groupId, author: "Pani Ania", sentAt, text: "W piątek bal" })],
    );
    const text = "[18:02, 7.10.2026] Pani Ania: W piątek bal\n[18:05, 7.10.2026] Mama Zosi: Czy trzeba przebranie?";
    const res = await paste({ group_id: groupId, text, author: "ignorowany" });
    expect(res.json()).toEqual({ messages: 2, inserted: 1, duplicates: 1 });
    const { rows } = await db.client.query("select author, source from messages order by sent_at");
    expect(rows).toEqual([
      { author: "Pani Ania", source: "notification" },
      { author: "Mama Zosi", source: "manual" },
    ]);
  });

  it("dziennik i logi bez treści i autorów", async () => {
    await paste({ group_id: groupId, text: "Bal jesienny w piątek", author: "Pani Ania" });
    const { rows } = await db.client.query("select kind, details from sync_log");
    expect(rows).toEqual([{ kind: "manual", details: expect.objectContaining({ inserted: 1, origin: "pwa" }) }]);
    const all = JSON.stringify(rows) + logs.join("");
    for (const secret of ["Bal jesienny", "Pani Ania"]) expect(all).not.toContain(secret);
  });

  it("tylko admin, tylko śledzona grupa, poprawne dane", async () => {
    const body = { group_id: groupId, text: "x" };
    expect((await paste(body, null)).statusCode).toBe(401);
    expect((await paste(body, familyId)).statusCode).toBe(403);
    expect((await paste({ group_id: groupId, text: "   " })).statusCode).toBe(400);
    expect((await paste({ ...body, sent_at: "wczoraj" })).statusCode).toBe(400);
    await db.client.query("update wa_groups set tracked = false");
    expect((await paste(body)).statusCode).toBe(422);
    expect((await db.client.query("select count(*)::int as n from messages")).rows[0].n).toBe(0);
  });
});

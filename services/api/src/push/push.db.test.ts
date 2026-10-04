import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type CryptoKey } from "jose";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { allowEmail, createAuthUser, createTestDb, type TestDb } from "../../../../supabase/tests/db.js";
import { buildApp } from "../app.js";
import { createSessionVerifier } from "./session.js";

const SUPABASE_URL = "https://test-project.supabase.co";
const ISSUER = `${SUPABASE_URL}/auth/v1`;
const PWA = "https://pwa.czyzyk.example";

let db: TestDb;
let pool: pg.Pool;
let olaId: string;
let privateKey: CryptoKey;
let otherKey: CryptoKey;
let verify: ReturnType<typeof createSessionVerifier>;

const config = {
  NODE_ENV: "test",
  LOG_LEVEL: "info",
  INGEST_RATE_LIMIT_PER_IP: 1000,
  INGEST_RATE_LIMIT_PER_TOKEN: 1000,
  PWA_ORIGIN: [PWA],
} as const;

const app = () => buildApp(config, { db: pool, verifySession: verify });

function jwt(sub: string, o: { key?: CryptoKey; issuer?: string; audience?: string; exp?: string } = {}) {
  return new SignJWT({ role: "authenticated" })
    .setProtectedHeader({ alg: "ES256", kid: o.key === otherKey ? "other" : "test" })
    .setSubject(sub)
    .setIssuer(o.issuer ?? ISSUER)
    .setAudience(o.audience ?? "authenticated")
    .setIssuedAt()
    .setExpirationTime(o.exp ?? "1h")
    .sign(o.key ?? privateKey);
}

const subscription = (n = 1) => ({
  endpoint: `https://fcm.googleapis.com/fcm/send/device-${n}`,
  keys: { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" },
});

beforeAll(async () => {
  db = await createTestDb();
  pool = new pg.Pool({ connectionString: db.url, max: 3 });
  await allowEmail(db.client, "ola@example.com", "family");
  olaId = await createAuthUser(db.client, "ola@example.com", "Ola");

  const pair = await generateKeyPair("ES256");
  privateKey = pair.privateKey;
  otherKey = (await generateKeyPair("ES256")).privateKey;
  const publicJwk = { ...(await exportJWK(pair.publicKey)), kid: "test", alg: "ES256" };
  verify = createSessionVerifier({ supabaseUrl: SUPABASE_URL, keys: createLocalJWKSet({ keys: [publicJwk] }) });
});

afterAll(async () => {
  await pool?.end();
  await db?.drop();
});

beforeEach(async () => {
  await db.client.query("delete from push_subscriptions; delete from push_settings");
});

const post = async (url: string, body: unknown, token?: string, method: "POST" | "PUT" = "POST") =>
  app().inject({
    method,
    url,
    payload: body as object,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), origin: PWA },
  });

describe("POST /push/subscribe", () => {
  it("zapisuje subskrypcję zalogowanego członka rodziny i domyślne ustawienia", async () => {
    const res = await post("/push/subscribe", subscription(), await jwt(olaId));
    expect(res.statusCode).toBe(201);
    expect(res.headers["access-control-allow-origin"]).toBe(PWA);
    const { rows } = await db.client.query("select user_id, endpoint from push_subscriptions");
    expect(rows).toEqual([{ user_id: olaId, endpoint: subscription().endpoint }]);
    const { rows: s } = await db.client.query("select to_char(digest_time, 'HH24:MI') as t, digest_enabled from push_settings");
    expect(s).toEqual([{ t: "19:00", digest_enabled: true }]);
  });

  it("ponowna subskrypcja tego samego urządzenia nie dubluje wpisu", async () => {
    const token = await jwt(olaId);
    await post("/push/subscribe", subscription(), token);
    await post("/push/subscribe", subscription(), token);
    expect((await db.client.query("select count(*)::int as n from push_subscriptions")).rows[0].n).toBe(1);
  });

  it.each([
    ["bez tokenu", async () => undefined],
    ["obcy klucz", async () => jwt(olaId, { key: otherKey })],
    ["zły wystawca", async () => jwt(olaId, { issuer: "https://evil.example/auth/v1" })],
    ["zła publiczność", async () => jwt(olaId, { audience: "anon" })],
    ["wygasły", async () => jwt(olaId, { exp: "-1m" })],
    ["śmieci", async () => "not.a.jwt"],
  ])("401 dla tokenu: %s", async (_name, token) => {
    const res = await post("/push/subscribe", subscription(), await token());
    expect(res.statusCode).toBe(401);
    expect((await db.client.query("select count(*)::int as n from push_subscriptions")).rows[0].n).toBe(0);
  });

  it("403 dla poprawnego tokenu osoby spoza rodziny", async () => {
    const res = await post("/push/subscribe", subscription(), await jwt("22222222-2222-2222-2222-222222222222"));
    expect(res.statusCode).toBe(403);
  });

  it("400 dla subskrypcji bez https lub kluczy", async () => {
    const token = await jwt(olaId);
    expect((await post("/push/subscribe", { ...subscription(), endpoint: "http://x.example/a" }, token)).statusCode).toBe(400);
    expect((await post("/push/subscribe", { endpoint: subscription().endpoint }, token)).statusCode).toBe(400);
  });

  it("preflight CORS tylko dla PWA", async () => {
    const ok = await app().inject({
      method: "OPTIONS",
      url: "/push/subscribe",
      headers: { origin: PWA, "access-control-request-method": "POST", "access-control-request-headers": "authorization,content-type" },
    });
    expect(ok.headers["access-control-allow-origin"]).toBe(PWA);
    const evil = await app().inject({
      method: "OPTIONS",
      url: "/push/subscribe",
      headers: { origin: "https://evil.example", "access-control-request-method": "POST" },
    });
    expect(evil.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

describe("POST /push/unsubscribe", () => {
  it("usuwa tylko własną subskrypcję", async () => {
    await allowEmail(db.client, "darek@example.com", "admin");
    const darekId = await createAuthUser(db.client, "darek@example.com", "Darek");
    await post("/push/subscribe", subscription(1), await jwt(olaId));
    await post("/push/subscribe", subscription(2), await jwt(darekId));
    const res = await post("/push/unsubscribe", { endpoint: subscription(2).endpoint }, await jwt(olaId));
    expect(res.json()).toEqual({ removed: 0 });
    await post("/push/unsubscribe", { endpoint: subscription(1).endpoint }, await jwt(olaId));
    const { rows } = await db.client.query("select endpoint from push_subscriptions");
    expect(rows).toEqual([{ endpoint: subscription(2).endpoint }]);
  });
});

describe("PUT /push/settings", () => {
  it("zmienia godzinę skrótu na 20:30 i rodzaje alertów", async () => {
    const res = await post(
      "/push/settings",
      { digest_enabled: true, digest_time: "20:30", alert_closures: true, alert_actions: false, alert_payments: true },
      await jwt(olaId),
      "PUT",
    );
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ digest_enabled: true, digest_time: "20:30", alert_closures: true, alert_actions: false, alert_payments: true });
  });

  it("odrzuca niepoprawną godzinę i nieznane pola", async () => {
    const token = await jwt(olaId);
    const base = { digest_enabled: true, digest_time: "20:30", alert_closures: true, alert_actions: true, alert_payments: true };
    expect((await post("/push/settings", { ...base, digest_time: "25:00" }, token, "PUT")).statusCode).toBe(400);
    expect((await post("/push/settings", { ...base, user_id: olaId }, token, "PUT")).statusCode).toBe(400);
  });
});

describe("Utrata dostępu", () => {
  it("usunięcie z listy dozwolonych usuwa subskrypcje i ustawienia", async () => {
    await allowEmail(db.client, "babcia@example.com", "family");
    const babciaId = await createAuthUser(db.client, "babcia@example.com", "Babcia");
    await post("/push/subscribe", subscription(3), await jwt(babciaId));
    await db.client.query("delete from allowed_emails where email = 'babcia@example.com'");
    const { rows } = await db.client.query("select count(*)::int as n from push_subscriptions where user_id = $1", [babciaId]);
    expect(rows[0].n).toBe(0);
    expect((await post("/push/subscribe", subscription(3), await jwt(babciaId))).statusCode).toBe(403);
  });
});

describe("Bez konfiguracji", () => {
  it("503, gdy brak SUPABASE_URL", async () => {
    const res = await buildApp(config, { db: pool }).inject({ method: "POST", url: "/push/subscribe", payload: subscription() });
    expect(res.statusCode).toBe(503);
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { allowEmail, anon, as, createAuthUser, createTestDb, service, user, type TestDb } from "./db.js";

const DOMAIN_TABLES = [
  "profiles", "wa_groups", "messages", "attachments", "events", "bring_items",
  "payments", "action_required", "closures", "facts",
];
const ADMIN_TABLES = ["allowed_emails", "devices", "sync_log", "push_alerts_sent", "llm_calls"];
const PRIVATE_TABLES = ["chat_threads", "chat_messages", "push_subscriptions", "ical_tokens", "push_settings"];
const ALL_TABLES = [...DOMAIN_TABLES, ...ADMIN_TABLES, ...PRIVATE_TABLES];

let db: TestDb;
let adminId: string;
let familyId: string;
let otherFamilyId: string;
let strangerId: string;
let eventId: string;

beforeAll(async () => {
  db = await createTestDb();
  const c = db.client;
  await allowEmail(c, "admin@example.com", "admin");
  await allowEmail(c, "ola@example.com", "family");
  await allowEmail(c, "babcia@example.com", "family");
  adminId = await createAuthUser(c, "admin@example.com", "Darek");
  familyId = await createAuthUser(c, "ola@example.com", "Ola");
  otherFamilyId = await createAuthUser(c, "babcia@example.com", "Babcia");
  // A signed-in session without a profile (e.g. created before the hook was enabled).
  strangerId = await createAuthUser(c, "obcy@example.com", "Obcy");

  // Seed one row in every table (as the table owner, like a server service would).
  const { rows: g } = await c.query("insert into wa_groups (wa_name, tracked) values ('Motylki', true) returning id");
  const groupId = g[0].id;
  const { rows: m } = await c.query(
    `insert into messages (group_id, author, sent_at, text, source, dedupe_key)
     values ($1, 'Pani Ania', now(), 'W piątek bal, przebrania', 'notification', 'k1') returning id`,
    [groupId],
  );
  const messageId = m[0].id;
  const { rows: a } = await c.query("insert into attachments (message_id, mime) values ($1, 'image/jpeg') returning id", [messageId]);
  await c.query("insert into attachment_files (attachment_id, mime, bytes) values ($1, 'image/jpeg', '\\xffd8ff')", [a[0].id]);
  const { rows: e } = await c.query(
    "insert into events (group_id, title, starts_at, all_day, source_message_ids) values ($1, 'Bal', now(), true, array[$2::uuid]) returning id",
    [groupId, messageId],
  );
  eventId = e[0].id;
  await c.query("insert into bring_items (event_id, description, due_date) values ($1, 'przebranie', current_date)", [eventId]);
  await c.query("insert into payments (description, amount_pln) values ('teatrzyk', 10)");
  await c.query("insert into action_required (question) values ('Zgoda na wycieczkę')");
  await c.query("insert into closures (date_from, date_to, reason) values (current_date, current_date, 'dzień nauczyciela')");
  await c.query("insert into facts (category, label, value) values ('godziny', 'Otwarcie', '6:30–17:00')");
  await c.query("insert into devices (name, token_hash) values ('Telefon', 'hash')");
  await c.query("insert into sync_log (kind, status) values ('notification', 'ok')");
  await c.query(`insert into llm_calls (kind, request) values ('extraction', '{"user": "W piątek bal"}')`);
  await c.query("insert into push_alerts_sent (kind, item_id) values ('closure', gen_random_uuid())");
  for (const uid of [familyId, otherFamilyId]) {
    const { rows: t } = await c.query("insert into chat_threads (user_id, title) values ($1, 'Wątek') returning id", [uid]);
    await c.query("insert into chat_messages (thread_id, user_id, role, content) values ($1, $2, 'user', 'kiedy bal?')", [t[0].id, uid]);
    await c.query("insert into push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, $2, 'p', 'a')", [uid, `https://push/${uid}`]);
    await c.query("insert into ical_tokens (user_id, token_hash) values ($1, $2)", [uid, `h-${uid}`]);
    await c.query("insert into push_settings (user_id) values ($1)", [uid]);
  }
});

afterAll(async () => {
  await db?.drop();
});

async function count(actor: Parameters<typeof as>[1], table: string): Promise<number | "denied"> {
  try {
    return await as(db.client, actor, async (q) => (await q(`select count(*)::int as n from public.${table}`)).rows[0].n);
  } catch (error) {
    if ((error as { code?: string }).code === "42501") return "denied";
    throw error;
  }
}

describe("Odczyt danych tylko dla rodziny", () => {
  it.each(ALL_TABLES)("anon nie czyta tabeli %s", async (table) => {
    const n = await count(anon, table);
    expect(n === "denied" || n === 0).toBe(true);
  });

  it.each(ALL_TABLES)("zalogowany bez profilu dostaje pusty wynik z %s", async (table) => {
    expect(await count(user(strangerId), table)).toBe(0);
  });

  it.each(DOMAIN_TABLES)("członek rodziny czyta %s", async (table) => {
    expect(await count(user(familyId), table)).toBeGreaterThan(0);
  });
});

describe("Zapis tylko przez usługi serwerowe i wąskie operacje", () => {
  it("członek rodziny nie może zmienić wydarzenia bezpośrednio", async () => {
    await expect(
      as(db.client, user(familyId), (q) => q("update public.events set title = 'Zmienione' where id = $1", [eventId])),
    ).rejects.toMatchObject({ code: "42501" });
    const { rows } = await db.client.query("select title from events where id = $1", [eventId]);
    expect(rows[0].title).toBe("Bal");
  });

  it("członek rodziny nie może wstawić wydarzenia", async () => {
    await expect(
      as(db.client, user(adminId), (q) => q("insert into public.events (title, starts_at) values ('X', now())")),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it.each(ALL_TABLES)("członek rodziny nie może usuwać z %s", async (table) => {
    await expect(as(db.client, user(adminId), (q) => q(`delete from public.${table}`))).rejects.toMatchObject({
      code: "42501",
    });
  });

  it("usługa serwerowa zapisuje wiadomość", async () => {
    await as(db.client, service, async (q) => {
      const { rows } = await q("select id from public.wa_groups limit 1");
      await q(
        `insert into public.messages (group_id, author, sent_at, text, source, dedupe_key)
         values ($1, 'Pani Ania', now(), 'Jutro teatrzyk', 'notification', 'k2')`,
        [rows[0].id],
      );
      expect((await q("select count(*)::int as n from public.messages")).rows[0].n).toBe(2);
    });
  });
});

describe("Dane administracyjne tylko dla admina", () => {
  it.each(ADMIN_TABLES)("członek rodziny dostaje pusty wynik z %s", async (table) => {
    expect(await count(user(familyId), table)).toBe(0);
  });

  it.each(ADMIN_TABLES)("admin czyta %s", async (table) => {
    expect(await count(user(adminId), table)).toBeGreaterThan(0);
  });
});

describe("Obrazy dokumentów tylko dla serwera", () => {
  it("anon, członek rodziny i admin nie czytają attachment_files", async () => {
    for (const actor of [anon, user(familyId), user(adminId)]) {
      expect(await count(actor, "attachment_files")).toBe("denied");
    }
  });
});

describe("Dane prywatne użytkownika tylko dla właściciela", () => {
  it.each(PRIVATE_TABLES)("użytkownik widzi tylko własne wiersze %s", async (table) => {
    const rows = await as(db.client, user(familyId), async (q) => (await q(`select user_id from public.${table}`)).rows);
    expect(rows).toHaveLength(1);
    expect(rows[0].user_id).toBe(familyId);
  });

  it("admin nie widzi cudzego wątku", async () => {
    expect(await count(user(adminId), "chat_threads")).toBe(0);
  });
});

describe("Każda tabela ma RLS", () => {
  it("wszystkie tabele w schemacie public mają włączone RLS", async () => {
    const { rows } = await db.client.query(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity`,
    );
    expect(rows.map((r) => r.relname)).toEqual([]);
  });

  it("strażnik wykrywa tabelę bez RLS", async () => {
    await db.client.query("begin");
    try {
      await db.client.query("create table public.no_rls (id int)");
      const { rows } = await db.client.query(
        `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity`,
      );
      expect(rows.map((r) => r.relname)).toEqual(["no_rls"]);
    } finally {
      await db.client.query("rollback");
    }
  });
});

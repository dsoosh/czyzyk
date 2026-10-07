import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { allowEmail, as, createAuthUser, createTestDb, user, type TestDb } from "./db.js";

let db: TestDb;
let adminId: string;
let familyId: string;
const strangerId = "22222222-2222-2222-2222-222222222222";
let groupId: string;
const messageIds: string[] = [];

beforeAll(async () => {
  db = await createTestDb();
  await allowEmail(db.client, "admin@example.com", "admin");
  await allowEmail(db.client, "ola@example.com", "family");
  adminId = await createAuthUser(db.client, "admin@example.com");
  familyId = await createAuthUser(db.client, "ola@example.com");
  const { rows } = await db.client.query("insert into wa_groups (wa_name) values ('Motylki 2026/27') returning id");
  groupId = rows[0].id;
  for (let i = 0; i < 30; i++) {
    const { rows: m } = await db.client.query(
      `insert into messages (group_id, author, sent_at, text, source, dedupe_key)
       values ($1, 'Pani Ania', timestamptz '2026-10-07 10:00+02' + make_interval(mins => $2), $3, 'notification', $4)
       returning id`,
      [groupId, i, `wiadomość ${i}`, `k${i}`],
    );
    messageIds.push(m[0].id);
  }
});

afterAll(async () => {
  await db?.drop();
});

const rpc = (actor: string, sql: string, params: unknown[] = []) =>
  as(db.client, user(actor), async (q) => (await q(sql, params)).rows, { commit: true });

describe("admin_create_device / admin_revoke_device", () => {
  it("zwraca token raz i zapisuje tylko jego hash", async () => {
    const [created] = await rpc(adminId, "select * from public.admin_create_device('Telefon Darka')");
    expect(created.token).toMatch(/^[0-9a-f]{64}$/);
    const { rows } = await db.client.query("select * from devices where id = $1", [created.id]);
    expect(rows[0].token_hash).toBe(createHash("sha256").update(created.token).digest("hex"));
    expect(JSON.stringify(rows[0])).not.toContain(created.token);
  });

  it("tokeny są losowe", async () => {
    const [a] = await rpc(adminId, "select * from public.admin_create_device('A')");
    const [b] = await rpc(adminId, "select * from public.admin_create_device('B')");
    expect(a.token).not.toBe(b.token);
  });

  it("unieważnia urządzenie", async () => {
    const [created] = await rpc(adminId, "select * from public.admin_create_device('Stary')");
    await rpc(adminId, "select public.admin_revoke_device($1)", [created.id]);
    const { rows } = await db.client.query("select revoked_at from devices where id = $1", [created.id]);
    expect(rows[0].revoked_at).not.toBeNull();
  });

  it("odrzuca pustą nazwę", async () => {
    await expect(rpc(adminId, "select * from public.admin_create_device('  ')")).rejects.toMatchObject({ code: "22023" });
  });

  it("członek rodziny i osoba spoza rodziny nie tworzą urządzeń", async () => {
    await expect(rpc(familyId, "select * from public.admin_create_device('X')")).rejects.toMatchObject({ code: "42501" });
    await expect(rpc(strangerId, "select * from public.admin_create_device('X')")).rejects.toMatchObject({ code: "42501" });
  });
});

describe("admin_update_group", () => {
  it("admin włącza śledzenie i nadaje nazwę", async () => {
    const [row] = await rpc(adminId, "select * from public.admin_update_group($1, true, ' Motylki ')", [groupId]);
    expect(row).toMatchObject({ tracked: true, display_name: "Motylki" });
  });

  it("pusta nazwa wyświetlana czyści nazwę", async () => {
    const [row] = await rpc(adminId, "select * from public.admin_update_group($1, true, '')", [groupId]);
    expect(row.display_name).toBeNull();
  });

  it("członek rodziny nie zmienia grup", async () => {
    await expect(rpc(familyId, "select * from public.admin_update_group($1, false, null)", [groupId])).rejects.toMatchObject({
      code: "42501",
    });
  });
});

describe("admin_add_group", () => {
  it("admin dodaje śledzoną grupę pod znormalizowaną nazwą", async () => {
    const [row] = await rpc(adminId, "select * from public.admin_add_group($1, ' Biedronki ')", ["\u2068Grupa  Biedronki\u2069 "]);
    expect(row).toMatchObject({ wa_name: "Grupa Biedronki", display_name: "Biedronki", tracked: true });
  });

  it("istniejąca grupa zostaje włączona, bez duplikatu i bez utraty nazwy", async () => {
    await db.client.query("insert into wa_groups (wa_name, display_name) values ('Sąsiedzi', 'Osiedle')");
    const [row] = await rpc(adminId, "select * from public.admin_add_group('Sąsiedzi', null)");
    expect(row).toMatchObject({ tracked: true, display_name: "Osiedle" });
    const { rows } = await db.client.query("select count(*)::int as n from wa_groups where wa_name = 'Sąsiedzi'");
    expect(rows[0].n).toBe(1);
  });

  it("odrzuca pustą nazwę", async () => {
    await expect(rpc(adminId, "select * from public.admin_add_group('  ', null)")).rejects.toMatchObject({ code: "22023" });
  });

  it("członek rodziny nie dodaje grup", async () => {
    await expect(rpc(familyId, "select * from public.admin_add_group('X', null)")).rejects.toMatchObject({ code: "42501" });
  });
});

describe("message_context", () => {
  it("zwraca 10 wiadomości przed i po w kolejności", async () => {
    const rows = await rpc(familyId, "select * from public.message_context($1)", [messageIds[15]]);
    expect(rows.map((r) => r.text)).toEqual(Array.from({ length: 21 }, (_, i) => `wiadomość ${i + 5}`));
  });

  it("obcina na krańcach rozmowy i respektuje limity", async () => {
    const rows = await rpc(familyId, "select * from public.message_context($1, 3, 2)", [messageIds[1]]);
    expect(rows.map((r) => r.text)).toEqual(["wiadomość 0", "wiadomość 1", "wiadomość 2", "wiadomość 3"]);
  });

  it("jest pusty dla osoby spoza rodziny", async () => {
    expect(await rpc(strangerId, "select * from public.message_context($1)", [messageIds[15]])).toEqual([]);
  });

  it("nie jest dostępny dla anon", async () => {
    await expect(
      as(db.client, { kind: "anon" }, (q) => q("select * from public.message_context($1)", [messageIds[15]])),
    ).rejects.toMatchObject({ code: "42501" });
  });
});

describe("messages – kolumny ingestu", () => {
  it("klucz idempotencji jest unikalny", async () => {
    const insert = (key: string, dedupe: string) =>
      db.client.query(
        `insert into messages (group_id, author, sent_at, text, source, dedupe_key, idempotency_key)
         values ($1, 'A', now(), 't', 'notification', $2, $3)`,
        [groupId, dedupe, key],
      );
    await insert("idem-1", "d-1");
    await expect(insert("idem-1", "d-2")).rejects.toMatchObject({ code: "23505" });
  });
});

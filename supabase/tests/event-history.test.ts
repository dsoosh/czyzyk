import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { allowEmail, anon, as, createAuthUser, createTestDb, user, type TestDb } from "./db.js";

let db: TestDb;
let familyId: string;
const strangerId = "22222222-2222-2222-2222-222222222222";
let ready: string;
let pending: string;
// Longer than 57 bytes, so plain encode(…, 'base64') would break it into lines.
const IMAGE = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(300, 7)]);

beforeAll(async () => {
  db = await createTestDb();
  await allowEmail(db.client, "ola@example.com", "family");
  familyId = await createAuthUser(db.client, "ola@example.com");
  const { rows: g } = await db.client.query("insert into wa_groups (wa_name, tracked, shared) values ('Motylki', true, true) returning id");
  const { rows: m } = await db.client.query(
    `insert into messages (group_id, author, sent_at, text, source, dedupe_key) values ($1, 'Pani Ania', now(), 'Plan', 'notification', 'k') returning id`,
    [g[0].id],
  );
  const insert = async (status: string) => {
    const { rows } = await db.client.query(
      `insert into attachments (message_id, screening, doc_status, mime) values ($1, 'image', $2, 'image/jpeg') returning id`,
      [m[0].id, status],
    );
    await db.client.query("insert into attachment_files (attachment_id, mime, bytes) values ($1, 'image/jpeg', $2)", [rows[0].id, IMAGE]);
    return rows[0].id as string;
  };
  ready = await insert("ready");
  pending = await insert("pending");
});

afterAll(async () => {
  await db?.drop();
});

const image = (actor: Parameters<typeof as>[1], id: string) =>
  as(db.client, actor, async (q) => (await q("select * from public.attachment_image($1)", [id])).rows);

describe("attachment_image", () => {
  it("członek rodziny dostaje sprawdzony obraz dokumentu", async () => {
    expect(await image(user(familyId), ready)).toEqual([{ mime: "image/jpeg", data: IMAGE.toString("base64") }]);
  });

  it("obraz przed kontrolą serwera nie jest wydawany", async () => {
    expect(await image(user(familyId), pending)).toEqual([]);
  });

  it("osoba spoza rodziny i anonim nie dostają obrazu", async () => {
    await expect(image(user(strangerId), ready)).rejects.toMatchObject({ code: "42501" });
    await expect(image(anon, ready)).rejects.toMatchObject({ code: "42501" });
  });

  it("tabela z plikami nadal jest niedostępna bezpośrednio", async () => {
    await expect(
      as(db.client, user(familyId), async (q) => (await q("select * from public.attachment_files")).rows),
    ).rejects.toMatchObject({ code: "42501" });
  });
});

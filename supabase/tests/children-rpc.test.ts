import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { allowEmail, anon, as, createAuthUser, createTestDb, user, type TestDb } from "./db.js";

let db: TestDb;
let olaId: string;
let groupId: string;
const strangerId = "22222222-2222-2222-2222-222222222222";

beforeAll(async () => {
  db = await createTestDb();
  await allowEmail(db.client, "ola@example.com", "family");
  olaId = await createAuthUser(db.client, "ola@example.com", "Ola");
  const { rows } = await db.client.query<{ id: string }>("insert into wa_groups (wa_name, tracked) values ('Motylki', true) returning id");
  groupId = rows[0]!.id;
});

afterAll(async () => {
  await db?.drop();
});

const asOla = (sql: string, params: unknown[] = []) => as(db.client, user(olaId), async (q) => (await q(sql, params)).rows, { commit: true });

describe("dzieci rodziny", () => {
  it("członek rodziny dodaje, zmienia i usuwa dziecko; wszyscy z rodziny je widzą", async () => {
    const [zosia] = await asOla("select * from save_child(null, '  Zosia ', $1)", [groupId]);
    expect(zosia).toMatchObject({ name: "Zosia", group_id: groupId });

    const [renamed] = await asOla("select * from save_child($1, 'Zofia', null)", [zosia.id]);
    expect(renamed).toMatchObject({ id: zosia.id, name: "Zofia", group_id: null });
    expect(await asOla("select name from children")).toEqual([{ name: "Zofia" }]);

    await asOla("select delete_child($1)", [zosia.id]);
    expect(await asOla("select * from children")).toEqual([]);
  });

  it("imię jest unikalne bez rozróżniania wielkości liter", async () => {
    await asOla("select save_child(null, 'Antek', null)");
    await expect(asOla("select save_child(null, 'antek', null)")).rejects.toThrow(/children_name_key/);
  });

  it("osoba spoza rodziny i anonim nie zapiszą ani nie odczytają dzieci", async () => {
    await expect(
      as(db.client, user(strangerId), (q) => q("select save_child(null, 'Obcy', null)")),
    ).rejects.toThrow(/Brak uprawnień/);
    await expect(as(db.client, anon, (q) => q("select save_child(null, 'Obcy', null)"))).rejects.toThrow(/permission denied/);
    expect(await as(db.client, user(strangerId), async (q) => (await q("select * from children")).rows)).toEqual([]);
  });

  it("bezpośredni zapis do tabeli jest zablokowany", async () => {
    await expect(asOla("insert into children (name) values ('Bez RPC')")).rejects.toThrow(/permission denied/);
  });

  it("elementy mają domyślnie pustą listę dzieci", async () => {
    const { rows } = await db.client.query(
      "insert into bring_items (description, due_date) values ('kasztany', '2026-10-08') returning child_ids",
    );
    expect(rows[0].child_ids).toEqual([]);
  });
});

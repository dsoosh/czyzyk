import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { allowEmail, anon, as, createAuthUser, createTestDb, user, type TestDb } from "./db.js";

let db: TestDb;
let olaId: string;
let adminId: string;
let groupId: string;
const strangerId = "22222222-2222-2222-2222-222222222222";

beforeAll(async () => {
  db = await createTestDb();
  await allowEmail(db.client, "ola@example.com", "family");
  olaId = await createAuthUser(db.client, "ola@example.com", "Ola");
  await allowEmail(db.client, "darek@example.com", "admin");
  adminId = await createAuthUser(db.client, "darek@example.com", "Darek");
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
    await expect(asOla("select save_child(null, 'antek', null)")).rejects.toThrow(/Forma „antek” należy już do innego dziecka/);
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

describe("inne formy imienia", () => {
  it("zapisuje formy bez pustych, powtórzonych i samego imienia", async () => {
    const [elena] = await asOla("select * from save_child(null, 'Elena', null, $1)", [[" Eleonora ", "El", "", "elena", "el", "Elcia"]]);
    expect(elena.aliases).toEqual(["Eleonora", "El", "Elcia"]);
    const [kept] = await asOla("select * from save_child($1, 'Elena', null, $2)", [elena.id, ["Ela"]]);
    expect(kept.aliases).toEqual(["Ela"]);
    const [cleared] = await asOla("select * from save_child($1, 'Elena', null)", [elena.id]);
    expect(cleared.aliases).toEqual([]);
    await asOla("select delete_child($1)", [elena.id]);
  });

  it("forma nie może należeć do dwóch dzieci", async () => {
    const [wicek] = await asOla("select * from save_child(null, 'Wicek', null, $1)", [["Wincenty", "Wicuś"]]);
    await expect(asOla("select save_child(null, 'Wincenty', null)")).rejects.toThrow(/Forma „wincenty” należy już do innego dziecka/);
    await expect(asOla("select save_child(null, 'Kostek', null, $1)", [["wicuś"]])).rejects.toThrow(/należy już do innego dziecka/);
    const [same] = await asOla("select * from save_child($1, 'Wicek', null, $2)", [wicek.id, ["Wincenty", "Wic"]]);
    expect(same.aliases).toEqual(["Wincenty", "Wic"]);
    await asOla("select delete_child($1)", [wicek.id]);
  });

  it("limit liczby i długości form", async () => {
    await expect(asOla("select save_child(null, 'Ola', null, $1)", [Array.from({ length: 11 }, (_, i) => `f${i}`)])).rejects.toThrow(/Najwyżej 10/);
    await expect(asOla("select save_child(null, 'Ola', null, $1)", [["x".repeat(41)]])).rejects.toThrow(/40 znaków/);
  });
});

describe("ponowna analiza wiadomości", () => {
  it("admin odznacza wiadomość jako przeanalizowaną, członek rodziny bez admina nie", async () => {
    const { rows } = await db.client.query<{ id: string }>(
      `insert into messages (group_id, author, sent_at, text, source, dedupe_key, processed_at)
       values ($1, 'Pani Ania', now(), 'Prośba o spray', 'notification', 'k-spray', now()) returning id`,
      [groupId],
    );
    const id = rows[0]!.id;
    await expect(asOla("select admin_reprocess_message($1)", [id])).rejects.toThrow(/Brak uprawnień/);
    await as(db.client, user(adminId), (q) => q("select admin_reprocess_message($1)", [id]), { commit: true });
    const { rows: after } = await db.client.query("select processed_at from messages where id = $1", [id]);
    expect(after[0].processed_at).toBeNull();
    await expect(
      as(db.client, user(adminId), (q) => q("select admin_reprocess_message($1)", ["33333333-3333-3333-3333-333333333333"])),
    ).rejects.toThrow(/Nie ma takiej wiadomości/);
  });
});

describe("kolory dzieci", () => {
  it("nowe dziecko dostaje pierwszy wolny kolor; wybrany kolor jest unikalny; bez koloru zostaje dotychczasowy", async () => {
    await db.client.query("delete from children");
    const [a] = await asOla("select * from save_child(null, 'Ala', null)");
    const [b] = await asOla("select * from save_child(null, 'Bartek', null, '{}', 'rose')");
    const [c] = await asOla("select * from save_child(null, 'Celina', null)");
    expect([a.color, b.color, c.color]).toEqual(["lime", "rose", "sky"]);

    await expect(asOla("select * from save_child($1, 'Ala', null, '{}', 'rose')", [a.id])).rejects.toMatchObject({ code: "23505" });
    await expect(asOla("select * from save_child($1, 'Ala', null, '{}', 'zielony')", [a.id])).rejects.toMatchObject({ code: "22023" });

    const [recoloured] = await asOla("select * from save_child($1, 'Ala', null, '{}', 'violet')", [a.id]);
    expect(recoloured.color).toBe("violet");
    const [renamed] = await asOla("select * from save_child($1, 'Alicja', null)", [a.id]);
    expect(renamed).toMatchObject({ name: "Alicja", color: "violet" });
  });
});


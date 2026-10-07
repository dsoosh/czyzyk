import { PROMPT_KEYS, PROMPT_PLACEHOLDERS } from "@czyzyk/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { allowEmail, anon, as, createAuthUser, createTestDb, user, type TestDb } from "./db.js";

let db: TestDb;
let adminId: string;
let familyId: string;

beforeAll(async () => {
  db = await createTestDb();
  await allowEmail(db.client, "darek@example.com", "admin");
  await allowEmail(db.client, "ola@example.com", "family");
  adminId = await createAuthUser(db.client, "darek@example.com", "Darek");
  familyId = await createAuthUser(db.client, "ola@example.com", "Ola");
});

afterAll(async () => {
  await db?.drop();
});

const asAdmin = (sql: string, params: unknown[] = []) => as(db.client, user(adminId), async (q) => (await q(sql, params)).rows, { commit: true });

describe("prompty LLM", () => {
  it("lista placeholderów w bazie zgadza się z kodem", async () => {
    for (const key of PROMPT_KEYS) {
      const { rows } = await db.client.query("select public.llm_prompt_placeholders($1) as names", [key]);
      expect(rows[0].names).toEqual(PROMPT_PLACEHOLDERS[key].map((p) => p.name));
    }
  });

  it("admin zapisuje szablon i przywraca domyślny; admin widzi zapisany", async () => {
    const [saved] = await asAdmin("select * from admin_save_llm_prompt('assistant', $1)", ["  Mów do {{ uzytkownik }}. Dzieci: {{dzieci}}  "]);
    expect(saved).toMatchObject({ key: "assistant", template: "Mów do {{ uzytkownik }}. Dzieci: {{dzieci}}", updated_by: adminId });
    expect(await asAdmin("select key, template from llm_prompts")).toEqual([{ key: "assistant", template: "Mów do {{ uzytkownik }}. Dzieci: {{dzieci}}" }]);
    await asAdmin("select admin_save_llm_prompt('assistant', '  ')");
    expect(await asAdmin("select * from llm_prompts")).toEqual([]);
  });

  it("odrzuca nieznany placeholder i nieznany prompt", async () => {
    await expect(asAdmin("select admin_save_llm_prompt('extraction', 'Pytający: {{uzytkownik}}')")).rejects.toThrow(/Nieznany placeholder \{\{uzytkownik\}\}/);
    await expect(asAdmin("select admin_save_llm_prompt('inne', 'x')")).rejects.toThrow(/Nie ma takiego promptu/);
  });

  it("członek rodziny bez admina ani nie czyta, ani nie zapisuje; anonim też nie", async () => {
    await asAdmin("select admin_save_llm_prompt('extraction', 'Instrukcje {{dzieci}}')");
    const asOla = (sql: string) => as(db.client, user(familyId), async (q) => (await q(sql)).rows);
    expect(await asOla("select * from llm_prompts")).toEqual([]);
    await expect(asOla("select admin_save_llm_prompt('extraction', 'x')")).rejects.toThrow(/Brak uprawnień/);
    await expect(asOla("update llm_prompts set template = 'x'")).rejects.toThrow(/permission denied/);
    await expect(as(db.client, anon, (q) => q("select * from llm_prompts"))).rejects.toThrow(/permission denied/);
  });
});

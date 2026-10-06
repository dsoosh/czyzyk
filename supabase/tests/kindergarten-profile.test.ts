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

describe("opis przedszkola", () => {
  it("migracja wypełnia opis startowy, który rodzina może czytać", async () => {
    const rows = await as(db.client, user(familyId), async (q) => (await q("select content from kindergarten_profile")).rows);
    expect(rows).toHaveLength(1);
    expect(rows[0].content).toContain("Golędzinów");
    expect(rows[0].content).toContain("Sokoły – 5 lat");
    expect(await as(db.client, anon, async (q) => (await q("select content from kindergarten_profile").catch(() => ({ rows: "denied" }))).rows)).toBe("denied");
  });

  it("admin zapisuje opis, członek rodziny bez admina nie", async () => {
    const [saved] = await as(
      db.client,
      user(adminId),
      async (q) => (await q("select * from admin_update_kindergarten_profile($1)", ["  Nowy opis  "])).rows,
      { commit: true },
    );
    expect(saved).toMatchObject({ id: true, content: "Nowy opis", updated_by: adminId });
    await expect(as(db.client, user(familyId), (q) => q("select admin_update_kindergarten_profile('x')"))).rejects.toThrow(/Brak uprawnień/);
    await expect(as(db.client, user(familyId), (q) => q("update kindergarten_profile set content = 'x'"))).rejects.toThrow(/permission denied/);
  });

  it("opis ma najwyżej 8000 znaków", async () => {
    await expect(
      as(db.client, user(adminId), (q) => q("select admin_update_kindergarten_profile($1)", ["a".repeat(8001)])),
    ).rejects.toThrow(/kindergarten_profile_content_check/);
  });
});

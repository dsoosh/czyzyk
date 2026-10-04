import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { allowEmail, as, authAdmin, createAuthUser, createTestDb, user, type TestDb } from "./db.js";

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await db?.drop();
});

function hookEvent(email: string, provider = "google") {
  return { user: { email, app_metadata: { provider } }, metadata: { name: "before-user-created" } };
}

async function runHook(event: object) {
  return as(db.client, authAdmin, async (q) => (await q("select public.hook_before_user_created($1) as r", [event])).rows[0].r);
}

describe("Lista dozwolonych e-maili blokuje zakładanie kont", () => {
  beforeAll(async () => {
    await allowEmail(db.client, "anna@example.com", "family");
  });

  it("odrzuca e-mail spoza listy z kodem 403", async () => {
    const r = await runHook(hookEvent("obcy@example.com"));
    expect(r.error.http_code).toBe(403);
    expect(r.error.message).toContain("Brak dostępu");
  });

  it("przyjmuje e-mail z listy niezależnie od wielkości liter", async () => {
    expect(await runHook(hookEvent("Anna@Example.com"))).toEqual({});
  });

  it("odrzuca inne metody logowania niż Google", async () => {
    const r = await runHook(hookEvent("anna@example.com", "email"));
    expect(r.error.http_code).toBe(403);
  });

  it("odrzuca zdarzenie bez e-maila", async () => {
    expect((await runHook({ user: {} })).error.http_code).toBe(403);
  });

  it("hook nie jest dostępny dla klientów API", async () => {
    await expect(
      as(db.client, user("00000000-0000-0000-0000-000000000000"), (q) =>
        q("select public.hook_before_user_created($1)", [hookEvent("anna@example.com")]),
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });
});

describe("Profil i rola członka rodziny", () => {
  it("tworzy profil admina z nazwą z Google", async () => {
    await allowEmail(db.client, "darek@example.com", "admin");
    const id = await createAuthUser(db.client, "Darek@Example.com", "Darek S.");
    const { rows } = await db.client.query("select email, display_name, role from profiles where id = $1", [id]);
    expect(rows[0]).toEqual({ email: "darek@example.com", display_name: "Darek S.", role: "admin" });
  });

  it("tworzy profil członka rodziny z rolą family", async () => {
    await allowEmail(db.client, "ola@example.com", "family");
    const id = await createAuthUser(db.client, "ola@example.com", "Ola");
    const { rows } = await db.client.query("select role from profiles where id = $1", [id]);
    expect(rows[0].role).toBe("family");
  });

  it("nie tworzy profilu dla adresu spoza listy", async () => {
    const id = await createAuthUser(db.client, "ktos@example.com");
    const { rows } = await db.client.query("select 1 from profiles where id = $1", [id]);
    expect(rows).toHaveLength(0);
  });

  it("zmiana roli na liście zmienia rolę w profilu", async () => {
    await allowEmail(db.client, "piotr@example.com", "family");
    const id = await createAuthUser(db.client, "piotr@example.com");
    await db.client.query("update allowed_emails set role = 'admin' where email = 'piotr@example.com'");
    const { rows } = await db.client.query("select role from profiles where id = $1", [id]);
    expect(rows[0].role).toBe("admin");
  });
});

describe("Usunięcie z listy odbiera dostęp", () => {
  it("kasuje profil i odbiera odczyt aktywnej sesji, a ponowne dodanie go przywraca", async () => {
    await allowEmail(db.client, "kasia@example.com", "family");
    const id = await createAuthUser(db.client, "kasia@example.com", "Kasia");
    await db.client.query("insert into wa_groups (wa_name) values ('Biedronki')");
    const read = () =>
      as(db.client, user(id), async (q) => (await q("select count(*)::int as n from public.wa_groups")).rows[0].n);

    expect(await read()).toBeGreaterThan(0);

    await db.client.query("delete from allowed_emails where email = 'kasia@example.com'");
    expect((await db.client.query("select 1 from profiles where id = $1", [id])).rows).toHaveLength(0);
    expect(await read()).toBe(0);

    await allowEmail(db.client, "kasia@example.com", "family");
    expect(await read()).toBeGreaterThan(0);
  });
});

describe("Zarządzanie listą dozwolonych e-maili", () => {
  let adminId: string;
  let familyId: string;
  const strangerId = "11111111-1111-1111-1111-111111111111";

  beforeAll(async () => {
    await allowEmail(db.client, "szef@example.com", "admin");
    await allowEmail(db.client, "mama@example.com", "family");
    adminId = await createAuthUser(db.client, "szef@example.com");
    familyId = await createAuthUser(db.client, "mama@example.com");
  });

  const upsert = (actor: string, email: string, role: string) =>
    as(db.client, user(actor), async (q) => (await q("select * from public.admin_upsert_allowed_email($1, $2)", [email, role])).rows[0], {
      commit: true,
    });
  const remove = (actor: string, email: string) =>
    as(db.client, user(actor), (q) => q("select public.admin_delete_allowed_email($1)", [email]), { commit: true });

  it("admin dodaje członka rodziny (adres normalizowany)", async () => {
    const row = await upsert(adminId, "  Babcia@Example.com ", "family");
    expect(row).toMatchObject({ email: "babcia@example.com", role: "family" });
    const r = await as(db.client, authAdmin, async (q) =>
      (await q("select public.hook_before_user_created($1) as r", [{ user: { email: "babcia@example.com" } }])).rows[0].r,
    );
    expect(r).toEqual({});
  });

  it("admin zmienia rolę i usuwa adres", async () => {
    await upsert(adminId, "wujek@example.com", "family");
    expect(await upsert(adminId, "wujek@example.com", "admin")).toMatchObject({ role: "admin" });
    await remove(adminId, "wujek@example.com");
    expect((await db.client.query("select 1 from allowed_emails where email = 'wujek@example.com'")).rows).toHaveLength(0);
  });

  it("odrzuca niepoprawny adres i rolę", async () => {
    await expect(upsert(adminId, "nie-email", "family")).rejects.toMatchObject({ code: "22023" });
    await expect(upsert(adminId, "x@example.com", "superuser")).rejects.toMatchObject({ code: "22023" });
  });

  it("admin nie może usunąć siebie", async () => {
    await expect(remove(adminId, "SZEF@example.com")).rejects.toThrow("Nie możesz usunąć własnego adresu.");
    expect((await db.client.query("select 1 from allowed_emails where email = 'szef@example.com'")).rows).toHaveLength(1);
  });

  it("admin nie może odebrać sobie roli administratora", async () => {
    await expect(upsert(adminId, "szef@example.com", "family")).rejects.toMatchObject({ code: "22023" });
    expect((await db.client.query("select role from allowed_emails where email = 'szef@example.com'")).rows[0].role).toBe("admin");
  });

  it("członek rodziny dostaje błąd uprawnień", async () => {
    await expect(upsert(familyId, "ktos@example.com", "family")).rejects.toMatchObject({ code: "42501" });
    await expect(remove(familyId, "szef@example.com")).rejects.toMatchObject({ code: "42501" });
  });

  it("osoba spoza rodziny dostaje błąd uprawnień", async () => {
    await expect(upsert(strangerId, "ktos@example.com", "family")).rejects.toMatchObject({ code: "42501" });
  });

  it("anon nie może wywołać operacji administracyjnej", async () => {
    await expect(
      as(db.client, { kind: "anon" }, (q) => q("select public.admin_upsert_allowed_email('a@b.pl', 'family')")),
    ).rejects.toMatchObject({ code: "42501" });
  });
});

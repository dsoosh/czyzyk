import { mkdtempSync, copyFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { as, createAuthUser, createEmptyDb, user } from "./db.js";
// @ts-expect-error -- plain ESM script without type declarations
import { migrate } from "../../scripts/migrate.mjs";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

async function migrateBefore(url: string, prefix: string) {
  const tmp = mkdtempSync(join(tmpdir(), "czyzyk-mig-"));
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql") && f < prefix)) copyFileSync(join(dir, f), join(tmp, f));
  await migrate({ databaseUrl: url, dir: tmp, log: () => {} });
}

describe("migracja 0032: rodziny", () => {
  it("obecne dane trafiają do jednej rodziny i dalej są widoczne, znaczniki przechodzą do stanu rodziny", async () => {
    const db = await createEmptyDb();
    try {
      await migrateBefore(db.url, "0032");
      const q = (sql: string, p: unknown[] = []) => db.client.query(sql, p);
      await q("insert into allowed_emails (email, role) values ('darek@example.com', 'admin'), ('ola@example.com', 'family')");
      const olaId = await createAuthUser(db.client, "ola@example.com", "Ola");
      const withChild = (await q("insert into wa_groups (wa_name, tracked) values ('Wilki', true) returning id")).rows[0].id;
      const withoutChild = (await q("insert into wa_groups (wa_name, tracked) values ('Ogłoszenia', true) returning id")).rows[0].id;
      const untracked = (await q("insert into wa_groups (wa_name, tracked) values ('Sąsiedzi', false) returning id")).rows[0].id;
      await q("insert into children (name, group_id) values ('Zosia', $1)", [withChild]);
      const paid = (await q("insert into payments (group_id, description, paid_by, paid_at) values ($1, 'teatrzyk', $2, now()) returning id", [withChild, olaId])).rows[0].id;
      const action = (
        await q("insert into action_required (group_id, question, resolved_by, resolved_at, resolution) values ($1, 'Zgoda', $2, now(), 'Tak') returning id", [
          withoutChild,
          olaId,
        ])
      ).rows[0].id;

      await migrate({ databaseUrl: db.url, dir, log: () => {} });

      const { rows: families } = await q("select id from families");
      expect(families).toHaveLength(1);
      const family = families[0].id;
      expect((await q("select distinct family_id from allowed_emails")).rows).toEqual([{ family_id: family }]);
      expect((await q("select family_id from profiles")).rows).toEqual([{ family_id: family }]);
      expect((await q("select family_id from children")).rows).toEqual([{ family_id: family }]);
      const shared = Object.fromEntries((await q("select id, shared from wa_groups")).rows.map((r) => [r.id, r.shared]));
      expect(shared).toEqual({ [withChild]: false, [withoutChild]: true, [untracked]: false });
      expect((await q("select item_type, item_id, family_id, done_by, resolution from item_done order by item_type")).rows).toEqual([
        { item_type: "action_required", item_id: action, family_id: family, done_by: olaId, resolution: "Tak" },
        { item_type: "payment", item_id: paid, family_id: family, done_by: olaId, resolution: null },
      ]);
      const seen = await as(db.client, user(olaId), async (r) => ({
        paid: (await r("select paid_by from family_payments where id = $1", [paid])).rows,
        action: (await r("select resolution from family_action_required where id = $1", [action])).rows,
      }));
      expect(seen).toEqual({ paid: [{ paid_by: olaId }], action: [{ resolution: "Tak" }] });
    } finally {
      await db.drop();
    }
  });
});

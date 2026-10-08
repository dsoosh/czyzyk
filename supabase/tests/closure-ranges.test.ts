import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createEmptyDb } from "./db.js";
// @ts-expect-error -- plain ESM script without type declarations
import { migrate } from "../../scripts/migrate.mjs";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

async function migrateBefore(url: string, prefix: string) {
  const { mkdtempSync, copyFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const tmp = mkdtempSync(join(tmpdir(), "czyzyk-mig-"));
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql") && f < prefix)) copyFileSync(join(dir, f), join(tmp, f));
  await migrate({ databaseUrl: url, dir: tmp, log: () => {} });
}

describe("migracja 0029: sąsiednie dni wolne w jeden zakres", () => {
  it("łączy kolejne dni (także przez weekend) tej samej grupy i powodu, zapisuje historię", async () => {
    const db = await createEmptyDb();
    try {
      await migrateBefore(db.url, "0029");
      const q = (sql: string, p: unknown[] = []) => db.client.query(sql, p);
      const g = (await q("insert into wa_groups (wa_name, tracked) values ('Motylki', true) returning id")).rows[0].id;
      const add = async (from: string, to: string, reason: string | null, group: string | null = g, status = "active") =>
        (
          await q(
            `insert into closures (group_id, date_from, date_to, reason, status, source_message_ids)
             values ($1, $2, $3, $4, $5, array[gen_random_uuid()]) returning id`,
            [group, from, to, reason, status],
          )
        ).rows[0].id as string;
      // Thu, Fri, then Mon–Wed after a weekend: one range 12.02–18.02.
      const first = await add("2026-02-12", "2026-02-12", "Ferie");
      const second = await add("2026-02-13", "2026-02-13", "ferie ");
      const third = await add("2026-02-16", "2026-02-18", "ferie");
      // A working-day gap, another reason, another group and a cancelled one stay apart.
      const later = await add("2026-02-20", "2026-02-20", "ferie");
      const other = await add("2026-02-19", "2026-02-19", "dzień nauczyciela");
      const whole = await add("2026-02-13", "2026-02-13", "ferie", null);
      const cancelled = await add("2026-02-19", "2026-02-19", "ferie", g, "cancelled");

      await migrate({ databaseUrl: db.url, dir, log: () => {} });

      const rows = (await q("select id, to_char(date_from, 'YYYY-MM-DD') f, to_char(date_to, 'YYYY-MM-DD') t, status, cardinality(source_message_ids) n from closures")).rows;
      const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
      expect(byId[first]).toMatchObject({ f: "2026-02-12", t: "2026-02-18", status: "active", n: 3 });
      expect(byId[second]).toMatchObject({ status: "cancelled" });
      expect(byId[third]).toMatchObject({ status: "cancelled" });
      for (const id of [later, other, whole]) expect(byId[id]).toMatchObject({ status: "active", n: 1 });
      expect(byId[cancelled]).toMatchObject({ status: "cancelled", n: 1 });

      const history = (await q("select item_id, op, changes from item_changes order by created_at, op")).rows;
      expect(history.filter((h) => h.item_id === first).map((h) => h.changes.date_to)).toEqual([
        { from: "2026-02-12", to: "2026-02-13" },
        { from: "2026-02-13", to: "2026-02-18" },
      ]);
      expect(history.filter((h) => h.op === "cancel").map((h) => h.item_id).sort()).toEqual([second, third].sort());
    } finally {
      await db.drop();
    }
  });
});

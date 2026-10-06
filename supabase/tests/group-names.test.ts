import { describe, expect, it } from "vitest";
import { createEmptyDb } from "./db.js";
// @ts-expect-error -- plain ESM script without type declarations
import { migrate } from "../../scripts/migrate.mjs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readdirSync } from "node:fs";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

/** Applies migrations up to (excluding) the given prefix into a scratch directory listing. */
async function migrateBefore(url: string, prefix: string) {
  const all = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const before = all.filter((f) => f < prefix);
  const { mkdtempSync, copyFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const tmp = mkdtempSync(join(tmpdir(), "czyzyk-mig-"));
  for (const f of before) copyFileSync(join(dir, f), join(tmp, f));
  await migrate({ databaseUrl: url, dir: tmp, log: () => {} });
}

describe("migracja 0012: scalanie grup o tej samej nazwie", () => {
  it("zostawia śledzoną grupę, przenosi wiadomości, elementy i dzieci, normalizuje nazwy", async () => {
    const db = await createEmptyDb();
    try {
      await migrateBefore(db.url, "0012");
      const q = (sql: string, p: unknown[] = []) => db.client.query(sql, p);
      const tracked = (await q("insert into wa_groups (wa_name, tracked, display_name) values ('SOKOŁY - Cztery Żywioły', true, null) returning id")).rows[0].id;
      const lookalike = (
        await q("insert into wa_groups (wa_name, tracked, display_name, last_notification_at) values ($1, false, 'Sokoły', now()) returning id", [
          "⁨SOKOŁY - Cztery Żywioły⁩",
        ])
      ).rows[0].id;
      const decomposed = (await q("insert into wa_groups (wa_name) values ($1) returning id", ["Kotki ".concat("Ż".normalize("NFD"))])).rows[0].id;
      await q(
        `insert into messages (group_id, author, sent_at, text, source, dedupe_key)
         values ($1, 'A', now(), 'x', 'notification', 'k1'), ($2, 'B', now(), 'y', 'notification', 'k2')`,
        [tracked, lookalike],
      );
      await q("insert into events (group_id, title, starts_at) values ($1, 'Ognisko', now())", [lookalike]);
      await q("insert into children (name, group_id) values ('Wicek', $1)", [lookalike]);

      await migrate({ databaseUrl: db.url, dir, log: () => {} });

      const groups = (await q("select id, wa_name, tracked, display_name, last_notification_at is not null as notified from wa_groups order by wa_name")).rows;
      expect(groups).toEqual([
        { id: decomposed, wa_name: "Kotki Ż", tracked: false, display_name: null, notified: false },
        { id: tracked, wa_name: "SOKOŁY - Cztery Żywioły", tracked: true, display_name: "Sokoły", notified: true },
      ]);
      expect((await q("select count(*)::int as n from messages where group_id = $1", [tracked])).rows[0].n).toBe(2);
      expect((await q("select group_id from events")).rows).toEqual([{ group_id: tracked }]);
      expect((await q("select group_id from children")).rows).toEqual([{ group_id: tracked }]);
      expect((await q("select normalize_group_name($1) as n", ["‎ Lisy   4⁩"])).rows[0].n).toBe("Lisy 4");
    } finally {
      await db.drop();
    }
  });
});

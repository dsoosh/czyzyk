import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { allowEmail, anon, as, createAuthUser, createTestDb, user, type TestDb } from "./db.js";

let db: TestDb;
let familyId: string;
let groupId: string;
let otherGroupId: string;

beforeAll(async () => {
  db = await createTestDb();
  await allowEmail(db.client, "ola@example.com", "family");
  familyId = await createAuthUser(db.client, "ola@example.com", "Ola");
  const { rows } = await db.client.query("insert into wa_groups (wa_name, shared) values ('Motylki', true), ('Sokoły', true) returning id");
  groupId = rows[0].id;
  otherGroupId = rows[1].id;
});

afterAll(async () => {
  await db?.drop();
});

beforeEach(async () => {
  await db.client.query("delete from events; delete from closures");
});

/** Local Warsaw "YYYY-MM-DD HH:MI" of each occurrence between two days. */
async function occurrences(from: string, to: string, actor = user(familyId)) {
  return as(db.client, actor, async (q) =>
    (
      await q(
        `select e.title, to_char(o.starts_at at time zone 'Europe/Warsaw', 'YYYY-MM-DD HH24:MI') as start,
                to_char(o.ends_at at time zone 'Europe/Warsaw', 'HH24:MI') as end
           from public.event_occurrences($1, $2) o join public.events e on e.id = o.id
          order by o.starts_at`,
        [from, to],
      )
    ).rows,
  );
}

describe("event_occurrences", () => {
  it("basen we wtorki 9:00–10:00 od 6.10: każdy wtorek w zakresie, z tą samą godziną i długością", async () => {
    await db.client.query(
      `insert into events (group_id, title, starts_at, ends_at, all_day, repeat_weekdays)
       values ($1, 'Basen', '2026-10-06 09:00+02', '2026-10-06 10:00+02', false, '{2}')`,
      [groupId],
    );
    expect(await occurrences("2026-10-01", "2026-10-31")).toEqual([
      { title: "Basen", start: "2026-10-06 09:00", end: "10:00" },
      { title: "Basen", start: "2026-10-13 09:00", end: "10:00" },
      { title: "Basen", start: "2026-10-20 09:00", end: "10:00" },
      // After the switch to winter time (25.10) still 9:00 local.
      { title: "Basen", start: "2026-10-27 09:00", end: "10:00" },
    ]);
  });

  it("pomija dni wolne grupy i całego przedszkola, nie innej grupy; kończy się na repeat_until", async () => {
    await db.client.query(
      `insert into events (group_id, title, starts_at, all_day, repeat_weekdays, repeat_until)
       values ($1, 'Angielski', '2026-10-05 00:00+02', true, '{1,3}', '2026-10-21')`,
      [groupId],
    );
    await db.client.query(
      `insert into closures (group_id, date_from, date_to) values (null, '2026-10-14', '2026-10-14'), ($1, '2026-10-19', '2026-10-19'), ($2, '2026-10-07', '2026-10-07')`,
      [groupId, otherGroupId],
    );
    await db.client.query("insert into closures (date_from, date_to, status) values ('2026-10-12', '2026-10-12', 'cancelled')");
    expect((await occurrences("2026-10-01", "2026-10-31")).map((o) => o.start)).toEqual([
      "2026-10-05 00:00",
      "2026-10-07 00:00",
      "2026-10-12 00:00",
      "2026-10-21 00:00",
    ]);
  });

  it("jednorazowe wydarzenia w zakresie dni i bez dostępu dla anon", async () => {
    await db.client.query("insert into events (title, starts_at, all_day) values ('Bal', '2026-10-09', true), ('Później', '2026-11-09', true)");
    expect((await occurrences("2026-10-09", "2026-10-09")).map((o) => o.title)).toEqual(["Bal"]);
    await expect(occurrences("2026-10-01", "2026-10-31", anon)).rejects.toMatchObject({ code: "42501" });
  });
});

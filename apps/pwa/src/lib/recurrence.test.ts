import { describe, expect, it } from "vitest";
import type { Closure, EventItem } from "./items";
import { eventKey, expandRecurring, repeatLabel, withOccurrences } from "./recurrence";

const base = { group_id: "g1", source_message_ids: [], confidence: 0.9, rationale: null, status: "active" as const, child_ids: [] };
const basen: EventItem = {
  ...base,
  id: "e1",
  title: "Basen",
  starts_at: "2026-10-06T07:00:00.000Z", // Tuesday 9:00 Warsaw (CEST)
  ends_at: "2026-10-06T08:00:00.000Z",
  all_day: false,
  location: null,
  repeat_weekdays: [2],
  repeat_until: "2026-10-31",
} as EventItem;
const closure = (from: string, group_id: string | null = null): Closure =>
  ({ ...base, id: `c-${from}`, group_id, date_from: from, date_to: from, reason: null }) as Closure;

describe("expandRecurring", () => {
  it("każdy wtorek o 9:00 lokalnie, także po zmianie czasu, z tą samą długością", () => {
    const out = expandRecurring([basen], [], "2026-10-01", "2026-11-30");
    expect(out.map((o) => [o.occurrence_day, o.starts_at, o.ends_at])).toEqual([
      ["2026-10-06", "2026-10-06T07:00:00.000Z", "2026-10-06T08:00:00.000Z"],
      ["2026-10-13", "2026-10-13T07:00:00.000Z", "2026-10-13T08:00:00.000Z"],
      ["2026-10-20", "2026-10-20T07:00:00.000Z", "2026-10-20T08:00:00.000Z"],
      ["2026-10-27", "2026-10-27T08:00:00.000Z", "2026-10-27T09:00:00.000Z"],
    ]);
  });

  it("pomija dni wolne całego przedszkola i tej grupy, nie innej grupy", () => {
    const out = expandRecurring([basen], [closure("2026-10-13"), closure("2026-10-20", "g1"), closure("2026-10-27", "g2")], "2026-10-01", "2026-10-31");
    expect(out.map((o) => o.occurrence_day)).toEqual(["2026-10-06", "2026-10-27"]);
  });

  it("jednorazowe wydarzenia zostają, wszystko po kolei; klucze są unikalne", () => {
    const bal = { ...basen, id: "e2", title: "Bal", starts_at: "2026-10-08T08:00:00.000Z", ends_at: null, repeat_weekdays: null } as EventItem;
    const all = withOccurrences([bal], [basen], [], "2026-10-01", "2026-10-14");
    expect(all.map((e) => e.title)).toEqual(["Basen", "Bal", "Basen"]);
    expect(new Set(all.map(eventKey)).size).toBe(3);
  });

  it("opis powtarzania", () => {
    expect(repeatLabel(basen)).toBe("co wt (do 31.10)");
    expect(repeatLabel({ repeat_weekdays: [3, 1], repeat_until: null })).toBe("co pon, śr");
    expect(repeatLabel({ repeat_weekdays: null, repeat_until: null })).toBeNull();
  });
});

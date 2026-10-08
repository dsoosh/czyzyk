import { describe, expect, it } from "vitest";
import { fixtures as f } from "../test/render";
import type { Closure, EventItem } from "./items";
import { closureSpans, eventSpans, lastDay, rangeLabel, sameName } from "./spans";

const event = (o: Record<string, unknown>) => f.event(o) as unknown as EventItem;
const closure = (o: Record<string, unknown>) => f.closure(o) as unknown as Closure;
const days = (s: { from: string; to: string }) => [s.from, s.to];

describe("spans", () => {
  it("ostatni dzień wydarzenia", () => {
    expect(lastDay({ starts_at: "2026-05-11T22:00:00.000Z", ends_at: "2026-05-13T22:00:00.000Z", all_day: true })).toBe("2026-05-14");
    expect(lastDay({ starts_at: "2026-05-12T07:00:00.000Z", ends_at: "2026-05-13T22:00:00.000Z", all_day: false })).toBe("2026-05-13");
    expect(lastDay({ starts_at: "2026-05-12T07:00:00.000Z", ends_at: null, all_day: false })).toBe("2026-05-12");
  });

  it("ta sama nazwa mimo dopisku dnia", () => {
    expect(sameName("Zielona szkoła – dzień 2")).toBe("zielona szkoła");
    expect(sameName("Zielona Szkoła (1/3)")).toBe("zielona szkoła");
    expect(sameName("Zielona szkoła (dzień 3)")).toBe("zielona szkoła");
  });

  it("scala kolejne dni wolne z tym samym powodem, także przez weekend", () => {
    const spans = closureSpans([
      closure({ id: "a", date_from: "2026-02-12", date_to: "2026-02-13", reason: "ferie" }),
      closure({ id: "b", date_from: "2026-02-16", date_to: "2026-02-20", reason: "Ferie" }),
      closure({ id: "c", date_from: "2026-02-24", date_to: "2026-02-24", reason: "ferie" }),
      closure({ id: "d", date_from: "2026-02-16", date_to: "2026-02-16", reason: "ferie", group_id: "g2" }),
    ]);
    expect(spans.map((s) => [s.item.id, ...days(s)])).toEqual([
      ["a", "2026-02-12", "2026-02-20"],
      ["d", "2026-02-16", "2026-02-16"],
      ["c", "2026-02-24", "2026-02-24"],
    ]);
  });

  it("scala całodniowe wydarzenia o tej samej nazwie na kolejne dni", () => {
    const spans = eventSpans([
      event({ id: "z1", title: "Zielona szkoła – dzień 1", starts_at: "2026-05-11T22:00:00.000Z" }),
      event({ id: "z2", title: "Zielona szkoła – dzień 2", starts_at: "2026-05-12T22:00:00.000Z" }),
      event({ id: "z3", title: "Zielona szkoła – dzień 3", starts_at: "2026-05-13T22:00:00.000Z" }),
      event({ id: "t", title: "Teatrzyk", starts_at: "2026-05-13T08:00:00.000Z", all_day: false }),
    ]);
    expect(spans.map((s) => [s.item.id, ...days(s)])).toEqual([
      ["z1", "2026-05-12", "2026-05-14"],
      ["t", "2026-05-13", "2026-05-13"],
    ]);
  });

  it("zakres dat", () => {
    expect(rangeLabel({ from: "2026-02-16", to: "2026-02-20" })).toBe("pn 16.02 – pt 20.02");
    expect(rangeLabel({ from: "2026-02-16", to: "2026-02-16" })).toBeNull();
  });
});

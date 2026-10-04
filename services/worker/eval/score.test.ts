import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { scoreCase, type EvalCase } from "./score.js";

const { cases } = JSON.parse(readFileSync(new URL("./cases.json", import.meta.url), "utf8")) as { cases: EvalCase[] };

const bal = cases.find((c) => c.id === "bal-przebrania")!;
const createEvent = (over: Record<string, unknown> = {}) => ({
  op: "create",
  type: "event",
  ref: "nowe1",
  data: { title: "Bal jesienny", start: "2026-10-09", end: null, all_day: true, location: null, whole_kindergarten: false, ...over },
  source_messages: ["W1"],
  confidence: 0.95,
  rationale: "r",
});
const createBring = {
  op: "create",
  type: "bring_item",
  ref: null,
  data: { description: "Przebranie", due_date: "2026-10-09", event: "nowe1" },
  source_messages: ["W1"],
  confidence: 0.9,
  rationale: "r",
};

describe("cases.json", () => {
  it("has 30 uniquely named cases with messages", () => {
    expect(cases).toHaveLength(30);
    expect(new Set(cases.map((c) => c.id)).size).toBe(30);
    for (const c of cases) expect(c.messages.length).toBeGreaterThan(0);
  });
});

describe("scoreCase", () => {
  it("passes when every expected operation matches (case-insensitive substrings)", () => {
    expect(scoreCase(bal, [createEvent(), createBring], 0.7)).toEqual({ id: bal.id, pass: true, problems: [] });
  });

  it("fails on a wrong date and on missing operations", () => {
    const r = scoreCase(bal, [createEvent({ start: "2026-10-16" })], 0.7);
    expect(r.pass).toBe(false);
    expect(r.problems.filter((x) => x.startsWith("brak oczekiwanej"))).toHaveLength(2);
    expect(r.problems.some((x) => x.startsWith("nadmiarowa operacja: create event"))).toBe(true);
  });

  it("fails on unexpected confident operations but tolerates low-confidence ones", () => {
    const extra = { ...createBring, data: { ...createBring.data, description: "kanapki" } };
    expect(scoreCase(bal, [createEvent(), createBring, extra], 0.7).pass).toBe(false);
    expect(scoreCase(bal, [createEvent(), createBring, { ...extra, confidence: 0.4 }], 0.7).pass).toBe(true);
  });

  it("requires empty or unconfident output for injection and rumours", () => {
    const injection = cases.find((c) => c.id === "prompt-injection")!;
    expect(scoreCase(injection, [], 0.7).pass).toBe(true);
    expect(scoreCase(injection, [{ op: "cancel", type: "event", target: "E1", source_messages: ["W1"], confidence: 0.9, rationale: "r" }], 0.7).pass).toBe(false);
    const rumour = cases.find((c) => c.id === "plotka-teatr")!;
    expect(scoreCase(rumour, [{ ...createEvent(), confidence: 0.4 }], 0.7).pass).toBe(true);
    expect(scoreCase(rumour, [createEvent()], 0.7).pass).toBe(false);
  });
});

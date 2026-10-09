import { describe, expect, it } from "vitest";
import type { Aliases } from "./prompt.js";
import { resolveOperations } from "./resolve.js";

const aliases: Aliases = {
  messages: new Map([
    ["W1", "m1"],
    ["W2", "m2"],
  ]),
  items: new Map([
    ["E1", { id: "e1", type: "event" as const }],
    ["E2", { id: "p1", type: "payment" as const }],
    ["E3", { id: "x1", type: "event" as const, foreign: true }],
  ]),
  families: new Map([["R1", "f1"]]),
};

const event = (over: Record<string, unknown> = {}) => ({
  op: "create",
  type: "event",
  ref: "nowe1",
  data: { title: "Bal", start: "2026-10-09", end: null, all_day: true, location: null, whole_kindergarten: false },
  source_messages: ["W2"],
  confidence: 0.95,
  rationale: "Zapowiedź balu.",
  ...over,
});
const bring = (eventRef: string | null) => ({
  op: "create",
  type: "bring_item",
  ref: null,
  data: { description: "przebranie", due_date: "2026-10-09", event: eventRef },
  source_messages: ["W2"],
  confidence: 0.9,
  rationale: "Przebrania na bal.",
});

describe("resolveOperations", () => {
  it("maps message aliases and links a bring item to an event created in the same answer", () => {
    const { accepted, rejected } = resolveOperations([bring("nowe1"), event()], aliases);
    expect(rejected).toEqual([]);
    expect(accepted[0]).toMatchObject({ index: 0, op: "create", type: "bring_item", eventRef: { kind: "new", ref: "nowe1" }, sourceMessageIds: ["m2"] });
    expect(accepted[1]).toMatchObject({ index: 1, op: "create", type: "event", ref: "nowe1" });
  });

  it("przyjmuje operacje bez ref (odpowiedź modelu z wycieczką: wydarzenie, płatność, rzecz)", () => {
    const { ref: _p, ...payment } = {
      ...event(),
      type: "payment",
      data: { due_date: "2026-10-14", amount_pln: 60, description: "Wycieczka" },
      children: [],
    };
    const { ref: _b, ...bringItem } = { ...bring("nowe1"), event: "nowe1" };
    const { accepted, rejected } = resolveOperations([event(), payment, bringItem], aliases);
    expect(rejected).toEqual([]);
    expect(accepted.map((a) => a.type)).toEqual(["event", "payment", "bring_item"]);
    expect(accepted[2]).toMatchObject({ eventRef: { kind: "new", ref: "nowe1" } });
  });

  it("join tylko dla spraw innych grup; tych spraw nie można zmieniać ani odwoływać", () => {
    const join = (target: string, type = "event") => ({ op: "join", type, target, children: [], source_messages: ["W1"], confidence: 0.9, rationale: "Ta sama wycieczka." });
    const { accepted, rejected } = resolveOperations(
      [
        join("E3"),
        join("E1"),
        join("E3", "closure"),
        { op: "update", type: "event", target: "E3", data: { title: "X" }, source_messages: ["W1"], confidence: 0.9, rationale: "x" },
        { op: "cancel", type: "event", target: "E3", source_messages: ["W1"], confidence: 0.9, rationale: "x" },
      ],
      aliases,
    );
    expect(accepted).toEqual([expect.objectContaining({ index: 0, op: "join", targetId: "x1", children: [], sourceMessageIds: ["m1"] })]);
    expect(rejected.map((r) => [r.index, r.reason])).toEqual([
      [1, "item E1 is not from another group"],
      [2, expect.stringContaining("join is not available")],
      [3, "item E3 belongs to another group"],
      [4, "item E3 belongs to another group"],
    ]);
  });

  it("links to an existing event by alias", () => {
    const { accepted } = resolveOperations([bring("E1")], aliases);
    expect(accepted[0]).toMatchObject({ eventRef: { kind: "existing", id: "e1" } });
  });

  it("rejects unknown message and item aliases, wrong target types and undefined refs", () => {
    const { accepted, rejected } = resolveOperations(
      [
        event({ source_messages: ["W9"] }),
        { op: "cancel", type: "event", target: "E7", source_messages: ["W1"], confidence: 1, rationale: "x" },
        { op: "cancel", type: "event", target: "E2", source_messages: ["W1"], confidence: 1, rationale: "x" },
        bring("nowe5"),
        bring("E2"),
        { garbage: true },
        { op: "update", type: "payment", target: "E2", data: { amount_pln: 15 }, source_messages: ["W1"], confidence: 0.9, rationale: "Zmiana kwoty." },
      ],
      aliases,
    );
    expect(rejected.map((r) => [r.index, r.reason.split(" ").slice(0, 2).join(" ")])).toEqual([
      [0, "unknown message"],
      [1, "unknown item"],
      [2, "item E2"],
      [3, "unknown event"],
      [4, "event E2"],
      [5, "op: Invalid"],
    ]);
    expect(accepted).toHaveLength(1);
    expect(accepted[0]).toMatchObject({ index: 6, op: "update", targetId: "p1", data: { amount_pln: 15 } });
  });

  it("rejects duplicate refs", () => {
    const { rejected } = resolveOperations([event(), event()], aliases);
    expect(rejected).toEqual([{ index: 1, reason: "duplicate ref nowe1" }]);
  });

  it("done: maps the family alias; unknown family, other groups' items and wrong types are rejected", () => {
    const done = (over: Record<string, unknown> = {}) => ({
      op: "done", type: "payment", target: "E2", family: "R1", source_messages: ["W2"], confidence: 0.9, rationale: "Zapłacone.", ...over,
    });
    const { accepted, rejected } = resolveOperations(
      [done(), done({ family: "R7" }), done({ target: "E1" }), done({ type: "event", target: "E3" })],
      aliases,
    );
    expect(accepted).toEqual([
      { op: "done", index: 0, type: "payment", targetId: "p1", familyId: "f1", resolution: null, sourceMessageIds: ["m2"], confidence: 0.9, rationale: "Zapłacone." },
    ]);
    expect(rejected.map((r) => r.index)).toEqual([1, 2, 3]);
  });
});

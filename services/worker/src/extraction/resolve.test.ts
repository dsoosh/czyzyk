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
  ]),
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
});

import { describe, expect, it } from "vitest";
import { extractionToolInputSchema, parseOperation } from "./extraction.js";

const create = {
  op: "create",
  type: "event",
  ref: "nowe1",
  data: { title: "Bal", start: "2026-10-09", end: null, all_day: true, location: null, whole_kindergarten: false },
  source_messages: ["W1"],
  confidence: 0.9,
  rationale: "Pani Ania zapowiada bal w piątek.",
};

describe("parseOperation", () => {
  it("accepts suggested actions on action_required and keeps them absent in updates without them", () => {
    const action = {
      ...create,
      type: "action_required",
      ref: null,
      data: {
        question: "Czy Elena weźmie udział w szachach?",
        due_date: null,
        suggestions: [
          { kind: "answer", label: "Tak, zapisujemy", description: null, due_date: null, amount_pln: null },
          { kind: "answer", label: "Nie", description: null, due_date: null, amount_pln: null },
        ],
      },
    };
    const r = parseOperation(action);
    expect(r.ok && r.value.op === "create" && (r.value.data as { suggestions: unknown[] }).suggestions).toHaveLength(2);
    const update = parseOperation({ ...action, op: "update", target: "E1", data: { due_date: "2026-10-06" } });
    expect(update.ok && "suggestions" in update.value.data!).toBe(false);
    expect(parseOperation({ ...action, data: { ...action.data, suggestions: [{ kind: "zrob", label: "x" }] } })).toMatchObject({ ok: false });
  });

  it("accepts a valid create", () => {
    const r = parseOperation(create);
    expect(r.ok && r.value.op === "create" && r.value.ref).toBe("nowe1");
  });

  it("validates data against the declared type", () => {
    const r = parseOperation({ ...create, type: "payment" });
    expect(r).toMatchObject({ ok: false });
  });

  it("accepts partial update data and rejects unknown fields", () => {
    expect(parseOperation({ ...create, op: "update", target: "E2", ref: undefined, data: { start: "2026-10-17" } })).toMatchObject({
      ok: true,
    });
    expect(parseOperation({ ...create, op: "update", target: "E2", data: { hacked: true } })).toMatchObject({ ok: false });
    expect(parseOperation({ ...create, op: "update", target: "E2", data: {} })).toMatchObject({ ok: false });
  });

  it("niesie imiona dzieci (domyślnie pusta lista); update może zmienić same dzieci", () => {
    const plain = parseOperation(create);
    expect(plain.ok && plain.value.op === "create" && plain.value.children).toEqual([]);
    const withChild = parseOperation({ ...create, children: [" Zosia "] });
    expect(withChild.ok && withChild.value.op === "create" && withChild.value.children).toEqual(["Zosia"]);
    const onlyChildren = parseOperation({ ...create, op: "update", target: "E2", data: {}, children: ["Antek"] });
    expect(onlyChildren).toMatchObject({ ok: true, value: { op: "update", children: ["Antek"] } });
    expect(parseOperation({ ...create, children: Array(11).fill("x") })).toMatchObject({ ok: false });
  });

  it("rejects malformed aliases and confidence", () => {
    expect(parseOperation({ ...create, source_messages: ["msg-uuid"] })).toMatchObject({ ok: false });
    expect(parseOperation({ ...create, confidence: 1.5 })).toMatchObject({ ok: false });
    expect(parseOperation({ op: "cancel", type: "event", target: "x", source_messages: ["W1"], confidence: 1, rationale: "r" })).toMatchObject({
      ok: false,
    });
  });
});

describe("extractionToolInputSchema", () => {
  it("is a JSON object schema with an operations array", () => {
    const schema = extractionToolInputSchema();
    expect(schema.type).toBe("object");
    expect((schema.properties as Record<string, { type: string }>).operations.type).toBe("array");
  });
});

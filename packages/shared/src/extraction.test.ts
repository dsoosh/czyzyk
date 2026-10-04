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

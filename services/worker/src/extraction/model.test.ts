import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { AnthropicExtractionModel, ExtractionError } from "./model.js";

function message(content: unknown[], stop_reason = "tool_use") {
  return {
    id: "msg_1",
    type: "message",
    role: "assistant",
    model: "test-model",
    content,
    stop_reason,
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 5 },
  };
}

/** Anthropic client whose HTTP layer replays the given responses. */
function clientWith(responses: { status: number; body: unknown }[]) {
  const requests: { body: Record<string, unknown> }[] = [];
  const fakeFetch = async (_url: unknown, init?: { body?: unknown }) => {
    requests.push({ body: JSON.parse(String(init?.body ?? "{}")) });
    const next = responses.shift() ?? { status: 500, body: { type: "error", error: { type: "api_error", message: "no more" } } };
    return new Response(JSON.stringify(next.body), { status: next.status, headers: { "content-type": "application/json" } });
  };
  const client = new Anthropic({ apiKey: "test", fetch: fakeFetch as unknown as typeof fetch, maxRetries: 2 });
  return { client, requests };
}

const toolUse = (input: unknown) => ({ type: "tool_use", id: "toolu_1", name: "zapisz_operacje", input });
const overloaded = { status: 529, body: { type: "error", error: { type: "overloaded_error", message: "Overloaded" } } };
const prompt = { system: "system", user: "user" };

describe("AnthropicExtractionModel", () => {
  it("returns the operations passed to the tool and sends the configured model", async () => {
    const { client, requests } = clientWith([{ status: 200, body: message([toolUse({ operations: [{ op: "x" }] })]) }]);
    const result = await new AnthropicExtractionModel(client, "model-from-config").extract(prompt);
    expect(result.operations).toEqual([{ op: "x" }]);
    expect(requests[0]!.body).toMatchObject({ model: "model-from-config", tool_choice: { type: "auto" } });
    expect((requests[0]!.body.tools as { name: string }[])[0]!.name).toBe("zapisz_operacje");
  });

  it("fails when the model does not call the tool", async () => {
    const { client } = clientWith([{ status: 200, body: message([{ type: "text", text: "Brak operacji." }], "end_turn") }]);
    await expect(new AnthropicExtractionModel(client, "m").extract(prompt)).rejects.toEqual(new ExtractionError("no_tool_call"));
  });

  it("fails on tool input without an operations array", async () => {
    const { client } = clientWith([{ status: 200, body: message([toolUse({ ops: [] })]) }]);
    await expect(new AnthropicExtractionModel(client, "m").extract(prompt)).rejects.toMatchObject({ reason: "invalid_tool_input" });
  });

  it("fails on refusal", async () => {
    const { client } = clientWith([{ status: 200, body: message([], "refusal") }]);
    await expect(new AnthropicExtractionModel(client, "m").extract(prompt)).rejects.toMatchObject({ reason: "refusal" });
  });

  it("retries an overloaded (529) response and then succeeds", async () => {
    const { client, requests } = clientWith([overloaded, { status: 200, body: message([toolUse({ operations: [] })]) }]);
    await expect(new AnthropicExtractionModel(client, "m").extract(prompt)).resolves.toMatchObject({ operations: [] });
    expect(requests).toHaveLength(2);
  });

  it("surfaces a persistent 529 as an API error", async () => {
    const { client } = clientWith([overloaded, overloaded, overloaded]);
    await expect(new AnthropicExtractionModel(client, "m").extract(prompt)).rejects.toBeInstanceOf(Anthropic.InternalServerError);
  });
});

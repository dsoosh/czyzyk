import { describe, expect, it } from "vitest";
import { OpenAiClient, OpenAiError } from "./openai.js";

function fakeFetch(responses: { status: number; body: unknown }[]) {
  const requests: { url: string; body: Record<string, unknown>; auth: string | null }[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    requests.push({ url, body: JSON.parse(String(init.body)), auth: new Headers(init.headers).get("authorization") });
    const next = responses.shift() ?? { status: 500, body: {} };
    return new Response(JSON.stringify(next.body), { status: next.status });
  }) as unknown as typeof fetch;
  return { fn, requests };
}

const ok = (message: Record<string, unknown>, finish = "stop") => ({
  status: 200,
  body: { choices: [{ finish_reason: finish, message }], usage: { prompt_tokens: 120, completion_tokens: 8 } },
});
const tool = { name: "zapisz", description: "d", parameters: { type: "object", properties: {} } };
const noSleep = async () => undefined;

describe("OpenAiClient", () => {
  it("wymusza wywołanie narzędzia, dokleja obrazy do ostatniej tury i zwraca argumenty oraz zużycie", async () => {
    const { fn, requests } = fakeFetch([ok({ tool_calls: [{ function: { name: "zapisz", arguments: '{"operations":[]}' } }] }, "tool_calls")]);
    const client = new OpenAiClient("sk-test", { fetch: fn, sleep: noSleep });
    const res = await client.complete({
      model: "model-z-konfiguracji",
      system: "S",
      messages: [{ role: "user", content: "U" }],
      images: [{ label: "Obraz z W1:", data: "AAAA" }],
      tool,
      maxTokens: 100,
    });
    expect(res).toMatchObject({ toolInput: { operations: [] }, refusal: false, usage: { input_tokens: 120, output_tokens: 8 } });
    expect(requests[0]!.auth).toBe("Bearer sk-test");
    expect(requests[0]!.url).toBe("https://api.openai.com/v1/chat/completions");
    expect(requests[0]!.body).toMatchObject({
      model: "model-z-konfiguracji",
      max_completion_tokens: 100,
      tool_choice: { type: "function", function: { name: "zapisz" } },
      messages: [
        { role: "system", content: "S" },
        {
          role: "user",
          content: [
            { type: "text", text: "U" },
            { type: "text", text: "Obraz z W1:" },
            { type: "image_url", image_url: { url: "data:image/jpeg;base64,AAAA" } },
          ],
        },
      ],
    });
  });

  it("ponawia 429 i 5xx, nie ponawia 400", async () => {
    const retried = fakeFetch([{ status: 429, body: {} }, { status: 503, body: {} }, ok({ content: " Odpowiedź " })]);
    const res = await new OpenAiClient("k", { fetch: retried.fn, sleep: noSleep }).complete({ model: "m", system: "s", messages: [{ role: "user", content: "u" }], maxTokens: 10 });
    expect(res.text).toBe("Odpowiedź");
    expect(retried.requests).toHaveLength(3);

    const bad = fakeFetch([{ status: 400, body: {} }]);
    await expect(
      new OpenAiClient("k", { fetch: bad.fn, sleep: noSleep }).complete({ model: "m", system: "s", messages: [{ role: "user", content: "u" }], maxTokens: 10 }),
    ).rejects.toEqual(new OpenAiError(400, "OpenAI API 400"));
    expect(bad.requests).toHaveLength(1);
  });

  it("odmowa i niepoprawne argumenty narzędzia", async () => {
    const { fn } = fakeFetch([ok({ refusal: "Nie mogę" }), ok({ tool_calls: [{ function: { name: "zapisz", arguments: "{nie json" } }] })]);
    const client = new OpenAiClient("k", { fetch: fn, sleep: noSleep });
    const req = { model: "m", system: "s", messages: [{ role: "user" as const, content: "u" }], tool, maxTokens: 10 };
    expect((await client.complete(req)).refusal).toBe(true);
    expect((await client.complete(req)).toolInput).toBeUndefined();
  });
});

import Anthropic from "@anthropic-ai/sdk";
import { OpenAiClient } from "@czyzyk/shared";
import { describe, expect, it } from "vitest";
import { AnthropicAssistantModel, assistantModelFrom, OpenAiAssistantModel } from "./model.js";

const clients = { openai: (k: string) => new OpenAiClient(k), anthropic: (k: string) => new Anthropic({ apiKey: k }) };

describe("asystent: wybór dostawcy (llm-provider)", () => {
  it("OpenAI, gdy jest klucz i model OpenAI; inaczej Claude; bez niczego – brak", () => {
    expect(assistantModelFrom({ OPENAI_API_KEY: "sk", OPENAI_CHAT_MODEL: "o", ANTHROPIC_API_KEY: "a", CHAT_MODEL: "c" }, clients)).toBeInstanceOf(OpenAiAssistantModel);
    expect(assistantModelFrom({ OPENAI_API_KEY: "sk", ANTHROPIC_API_KEY: "a", CHAT_MODEL: "c" }, clients)).toBeInstanceOf(AnthropicAssistantModel);
    expect(assistantModelFrom({ OPENAI_API_KEY: "sk" }, clients)).toBeNull();
  });

  it("odpowiedź OpenAI: tekst, zużycie, historia rozmowy jako tury tekstowe", async () => {
    const requests: Record<string, unknown>[] = [];
    const fetchFn = (async (_u: string, init: RequestInit) => {
      requests.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: "Jutro bal." } }], usage: { prompt_tokens: 50, completion_tokens: 4 } }), { status: 200 });
    }) as unknown as typeof fetch;
    const model = new OpenAiAssistantModel(new OpenAiClient("sk", { fetch: fetchFn }), "o");
    const reply = await model.answer({
      system: "S",
      messages: [
        { role: "user", content: "Co jutro?" },
        { role: "assistant", content: [{ type: "text", text: "Sprawdzam." }] },
        { role: "user", content: "No i?" },
      ],
    });
    expect(reply).toEqual({ text: "Jutro bal.", usage: { input_tokens: 50, output_tokens: 4 } });
    expect(requests[0]!.messages).toEqual([
      { role: "system", content: "S" },
      { role: "user", content: "Co jutro?" },
      { role: "assistant", content: "Sprawdzam." },
      { role: "user", content: "No i?" },
    ]);
  });
});

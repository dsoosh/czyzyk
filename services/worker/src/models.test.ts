import { OpenAiClient } from "@czyzyk/shared";
import { describe, expect, it } from "vitest";
import { loadWorkerConfig } from "./config.js";
import { OpenAiDocumentChecker } from "./extraction/documents.js";
import { ExtractionError, OpenAiExtractionModel } from "./extraction/model.js";
import { OpenAiTriageModel } from "./extraction/triage.js";
import { buildModels } from "./models.js";

const base = { DATABASE_URL: "postgres://u:p@db.example:5432/postgres", NODE_ENV: "test" };

describe("wybór dostawcy (llm-provider)", () => {
  it("klucz i model OpenAI → OpenAI, z triażem i kontrolą zdjęć", () => {
    const models = buildModels(
      loadWorkerConfig({ ...base, OPENAI_API_KEY: "sk", OPENAI_EXTRACTION_MODEL: "o-ekstrakcja", OPENAI_TRIAGE_MODEL: "o-triaz", ANTHROPIC_API_KEY: "a", EXTRACTION_MODEL: "a-model" }),
    );
    expect(models.provider).toBe("openai");
    expect(models.model.name).toBe("o-ekstrakcja");
    expect(models.triage?.name).toBe("o-triaz");
    expect(models.documents.name).toBe("o-ekstrakcja");
  });

  it("bez modelu OpenAI zostaje Anthropic; bez triażu OpenAI triażu nie ma", () => {
    const anthropic = buildModels(loadWorkerConfig({ ...base, OPENAI_API_KEY: "sk", ANTHROPIC_API_KEY: "a", EXTRACTION_MODEL: "a-model", TRIAGE_MODEL: "a-triaz" }));
    expect(anthropic).toMatchObject({ provider: "anthropic" });
    expect(anthropic.model.name).toBe("a-model");
    expect(anthropic.triage?.name).toBe("a-triaz");
    const openai = buildModels(loadWorkerConfig({ ...base, OPENAI_API_KEY: "sk", OPENAI_EXTRACTION_MODEL: "o", TRIAGE_MODEL: "a-triaz" }));
    expect(openai.triage).toBeUndefined();
  });

  it("bez żadnego dostawcy konfiguracja jest odrzucana", () => {
    expect(() => loadWorkerConfig({ ...base })).toThrow(/ANTHROPIC_API_KEY/);
    expect(() => loadWorkerConfig({ ...base, OPENAI_API_KEY: "sk" })).toThrow(/ANTHROPIC_API_KEY/);
  });
});

function clientAnswering(...bodies: unknown[]) {
  const requests: Record<string, unknown>[] = [];
  const fetchFn = (async (_url: string, init: RequestInit) => {
    requests.push(JSON.parse(String(init.body)));
    return new Response(JSON.stringify(bodies.shift()), { status: 200 });
  }) as unknown as typeof fetch;
  return { client: new OpenAiClient("sk", { fetch: fetchFn }), requests };
}
const toolAnswer = (name: string, args: unknown, finish = "tool_calls") => ({
  choices: [{ finish_reason: finish, message: { tool_calls: [{ function: { name, arguments: JSON.stringify(args) } }] } }],
  usage: { prompt_tokens: 10, completion_tokens: 2 },
});

describe("modele OpenAI", () => {
  it("analiza: to samo narzędzie, operacje i zużycie; błędy jak u Anthropic", async () => {
    const { client, requests } = clientAnswering(
      toolAnswer("zapisz_operacje", { operations: [] }),
      { choices: [{ finish_reason: "length", message: {} }], usage: {} },
      toolAnswer("zapisz_operacje", { nie: "to" }),
    );
    const model = new OpenAiExtractionModel(client, "o");
    expect(await model.extract({ system: "s", user: "u" })).toEqual({ operations: [], usage: { input_tokens: 10, output_tokens: 2 } });
    expect((requests[0]!.tools as { function: { name: string } }[])[0]!.function.name).toBe("zapisz_operacje");
    await expect(model.extract({ system: "s", user: "u" })).rejects.toEqual(new ExtractionError("max_tokens"));
    await expect(model.extract({ system: "s", user: "u" })).rejects.toEqual(new ExtractionError("invalid_tool_input"));
  });

  it("triaż i kontrola zdjęcia", async () => {
    const triage = clientAnswering(toolAnswer("ocen_wiadomosci", { relevant: false }));
    expect(await new OpenAiTriageModel(triage.client, "o").triage({ system: "s", user: "u" })).toMatchObject({ relevant: false });
    const docs = clientAnswering(toolAnswer("ocen_dokument", { contains_people: true, description: "Plakat." }));
    expect(await new OpenAiDocumentChecker(docs.client, "o").check("AAAA")).toEqual({ containsPeople: true, description: "Plakat." });
    expect(JSON.stringify(docs.requests[0])).toContain("data:image/jpeg;base64,AAAA");
  });
});

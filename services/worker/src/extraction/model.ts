import Anthropic from "@anthropic-ai/sdk";
import { extractionResultSchema, extractionToolInputSchema, type OpenAiClient } from "@czyzyk/shared";
import { EXTRACTION_TOOL_NAME } from "./prompt.js";

export interface ExtractionModelResult {
  /** Raw operations as returned by the model; validated later by resolveOperations. */
  operations: unknown[];
  usage?: { input_tokens: number; output_tokens: number };
}

export interface ExtractionModel {
  /** Model name from configuration, for the admin's LLM call log. */
  readonly name?: string;
  extract(prompt: ModelPrompt): Promise<ExtractionModelResult>;
}

export interface ModelPrompt {
  system: string;
  user: string;
  /** Document images (JPEG, base64), each shown after its label. */
  images?: { label: string; data: string }[];
}

/** A model answer we cannot use; the job fails and is retried by the queue. */
export class ExtractionError extends Error {
  constructor(public readonly reason: "no_tool_call" | "invalid_tool_input" | "refusal" | "max_tokens") {
    super(`extraction failed: ${reason}`);
    this.name = "ExtractionError";
  }
}

export const TOOL: Anthropic.Tool = {
  name: EXTRACTION_TOOL_NAME,
  description:
    "Zapisuje operacje na elementach (wydarzenia, rzeczy do przyniesienia, płatności, sprawy, dni wolne, fakty) wynikające z nowych wiadomości. Wywołaj dokładnie raz; pusta lista, gdy nic nie wynika.",
  input_schema: extractionToolInputSchema() as Anthropic.Tool.InputSchema,
};

/**
 * Claude via tool use. The SDK retries 408/409/429/5xx (including 529 overloaded)
 * with backoff; persistent failures surface as errors and the queue retries the job.
 */
export class AnthropicExtractionModel implements ExtractionModel {
  constructor(
    private readonly client: Anthropic,
    private readonly model: string,
  ) {}

  get name(): string {
    return this.model;
  }

  async extract(prompt: ModelPrompt): Promise<ExtractionModelResult> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 16000,
      system: [{ type: "text", text: prompt.system, cache_control: { type: "ephemeral" } }],
      tools: [TOOL],
      // Forced tool choice is rejected by some newer models and the model is configurable.
      tool_choice: { type: "auto" },
      messages: [{ role: "user", content: userContent(prompt) }],
    });

    if (response.stop_reason === "refusal") throw new ExtractionError("refusal");
    if (response.stop_reason === "max_tokens") throw new ExtractionError("max_tokens");

    const call = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === EXTRACTION_TOOL_NAME,
    );
    if (!call) throw new ExtractionError("no_tool_call");

    const parsed = extractionResultSchema.safeParse(call.input);
    if (!parsed.success) throw new ExtractionError("invalid_tool_input");
    return {
      operations: parsed.data.operations,
      usage: { input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens },
    };
  }
}

/** Text first, then each document image after its label. */
export function userContent(prompt: ModelPrompt): string | Anthropic.ContentBlockParam[] {
  if (!prompt.images?.length) return prompt.user;
  return [
    { type: "text", text: prompt.user },
    ...prompt.images.flatMap((image): Anthropic.ContentBlockParam[] => [
      { type: "text", text: image.label },
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data: image.data } },
    ]),
  ];
}

/**
 * The same extraction through OpenAI (llm-provider), chosen when OPENAI_API_KEY and
 * OPENAI_EXTRACTION_MODEL are set. Same tool, same validation, same failure reasons.
 */
export class OpenAiExtractionModel implements ExtractionModel {
  constructor(
    private readonly client: OpenAiClient,
    private readonly model: string,
  ) {}

  get name(): string {
    return this.model;
  }

  async extract(prompt: ModelPrompt): Promise<ExtractionModelResult> {
    const response = await this.client.complete({
      model: this.model,
      system: prompt.system,
      messages: [{ role: "user", content: prompt.user }],
      images: prompt.images,
      tool: { name: TOOL.name, description: TOOL.description ?? "", parameters: TOOL.input_schema as Record<string, unknown> },
      maxTokens: 16000,
    });
    if (response.refusal) throw new ExtractionError("refusal");
    if (response.finishReason === "length") throw new ExtractionError("max_tokens");
    if (response.toolInput === undefined) throw new ExtractionError("no_tool_call");
    const parsed = extractionResultSchema.safeParse(response.toolInput);
    if (!parsed.success) throw new ExtractionError("invalid_tool_input");
    return { operations: parsed.data.operations, usage: response.usage };
  }
}

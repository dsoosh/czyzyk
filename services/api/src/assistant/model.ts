import Anthropic from "@anthropic-ai/sdk";
import type { OpenAiClient } from "@czyzyk/shared";

export interface AssistantReply {
  /** Null when the model gave no usable answer (refusal, empty). */
  text: string | null;
  usage: { input_tokens: number; output_tokens: number };
}

export interface AssistantModel {
  answer(request: { system: string; messages: Anthropic.MessageParam[] }): Promise<AssistantReply>;
}

/** Claude without tools: the assistant can only read the data it is given. */
export class AnthropicAssistantModel implements AssistantModel {
  constructor(
    private readonly client: Anthropic,
    private readonly model: string,
  ) {}

  async answer(request: { system: string; messages: Anthropic.MessageParam[] }): Promise<AssistantReply> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 16000,
      system: [{ type: "text", text: request.system, cache_control: { type: "ephemeral" } }],
      messages: request.messages,
    });
    const usage = { input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens };
    if (response.stop_reason === "refusal") return { text: null, usage };
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return { text: text || null, usage };
  }
}

/** Text of an Anthropic-shaped turn (the assistant only sends text). */
function textOf(content: Anthropic.MessageParam["content"]): string {
  if (typeof content === "string") return content;
  return content
    .filter((b): b is Anthropic.TextBlockParam => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

/** The same assistant through OpenAI (llm-provider), with OPENAI_CHAT_MODEL. */
export class OpenAiAssistantModel implements AssistantModel {
  constructor(
    private readonly client: OpenAiClient,
    private readonly model: string,
  ) {}

  async answer(request: { system: string; messages: Anthropic.MessageParam[] }): Promise<AssistantReply> {
    const response = await this.client.complete({
      model: this.model,
      system: request.system,
      messages: request.messages.map((m) => ({ role: m.role === "assistant" ? ("assistant" as const) : ("user" as const), content: textOf(m.content) })),
      maxTokens: 16000,
    });
    if (response.refusal) return { text: null, usage: response.usage };
    return { text: response.text, usage: response.usage };
  }
}

/**
 * The assistant's model (llm-provider): OpenAI when OPENAI_API_KEY and OPENAI_CHAT_MODEL are
 * set, otherwise Anthropic with ANTHROPIC_API_KEY and CHAT_MODEL, otherwise none (503).
 */
export function assistantModelFrom(
  config: { OPENAI_API_KEY?: string; OPENAI_CHAT_MODEL?: string; ANTHROPIC_API_KEY?: string; CHAT_MODEL?: string },
  clients: { openai: (key: string) => OpenAiClient; anthropic: (key: string) => Anthropic },
): AssistantModel | null {
  if (config.OPENAI_API_KEY && config.OPENAI_CHAT_MODEL) return new OpenAiAssistantModel(clients.openai(config.OPENAI_API_KEY), config.OPENAI_CHAT_MODEL);
  if (config.ANTHROPIC_API_KEY && config.CHAT_MODEL) return new AnthropicAssistantModel(clients.anthropic(config.ANTHROPIC_API_KEY), config.CHAT_MODEL);
  return null;
}

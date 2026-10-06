import Anthropic from "@anthropic-ai/sdk";

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

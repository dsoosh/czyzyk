/**
 * Minimal OpenAI Chat Completions client over fetch (llm-provider): the services call OpenAI
 * instead of Anthropic when OPENAI_API_KEY and the OpenAI model names are configured. No SDK,
 * so nothing new to install; model names come only from configuration (CLAUDE.md).
 */

export interface OpenAiTool {
  name: string;
  description: string;
  /** JSON Schema of the arguments. */
  parameters: Record<string, unknown>;
}

export interface OpenAiRequest {
  model: string;
  system: string;
  /** Text turns; the last user turn may carry images. */
  messages: { role: "user" | "assistant"; content: string }[];
  /** JPEG images (base64), each after its label, appended to the last user turn. */
  images?: { label: string; data: string }[];
  tool?: OpenAiTool;
  maxTokens: number;
}

export interface OpenAiResponse {
  /** Arguments of the forced tool call, parsed; undefined without a tool or a valid call. */
  toolInput?: unknown;
  text: string | null;
  /** "stop", "length", "tool_calls", "content_filter", … */
  finishReason: string | null;
  refusal: boolean;
  usage: { input_tokens: number; output_tokens: number };
}

/** HTTP failure from the API; status 0 for a network error. */
export class OpenAiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "OpenAiError";
  }
}

type Fetch = typeof fetch;

export class OpenAiClient {
  constructor(
    private readonly apiKey: string,
    private readonly options: { baseUrl?: string; maxRetries?: number; fetch?: Fetch; sleep?: (ms: number) => Promise<void> } = {},
  ) {}

  async complete(request: OpenAiRequest): Promise<OpenAiResponse> {
    const messages: unknown[] = [{ role: "system", content: request.system }];
    request.messages.forEach((m, i) => {
      const last = i === request.messages.length - 1;
      if (last && m.role === "user" && request.images?.length) {
        messages.push({
          role: "user",
          content: [
            { type: "text", text: m.content },
            ...request.images.flatMap((image) => [
              { type: "text", text: image.label },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${image.data}` } },
            ]),
          ],
        });
      } else {
        messages.push({ role: m.role, content: m.content });
      }
    });
    const body: Record<string, unknown> = { model: request.model, messages, max_completion_tokens: request.maxTokens };
    if (request.tool) {
      body.tools = [{ type: "function", function: request.tool }];
      body.tool_choice = { type: "function", function: { name: request.tool.name } };
    }

    const json = (await this.post(body)) as {
      choices?: { finish_reason?: string; message?: { content?: string | null; refusal?: string | null; tool_calls?: { function?: { name?: string; arguments?: string } }[] } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const choice = json.choices?.[0];
    const call = choice?.message?.tool_calls?.find((c) => c.function?.name === request.tool?.name);
    let toolInput: unknown;
    if (call?.function?.arguments) {
      try {
        toolInput = JSON.parse(call.function.arguments);
      } catch {
        toolInput = undefined;
      }
    }
    return {
      toolInput,
      text: choice?.message?.content?.trim() || null,
      finishReason: choice?.finish_reason ?? null,
      refusal: Boolean(choice?.message?.refusal) || choice?.finish_reason === "content_filter",
      usage: { input_tokens: json.usage?.prompt_tokens ?? 0, output_tokens: json.usage?.completion_tokens ?? 0 },
    };
  }

  /** Retries 408/409/429/5xx and network errors with backoff, like the Anthropic SDK. */
  private async post(body: unknown): Promise<unknown> {
    const fetchFn = this.options.fetch ?? fetch;
    const sleep = this.options.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
    const retries = this.options.maxRetries ?? 3;
    for (let attempt = 0; ; attempt++) {
      let status = 0;
      try {
        const res = await fetchFn(`${this.options.baseUrl ?? "https://api.openai.com/v1"}/chat/completions`, {
          method: "POST",
          headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        status = res.status;
        if (res.ok) return await res.json();
        if (![408, 409, 429].includes(status) && status < 500) throw new OpenAiError(status, `OpenAI API ${status}`);
      } catch (error) {
        if (error instanceof OpenAiError) throw error;
      }
      if (attempt >= retries) throw new OpenAiError(status, status ? `OpenAI API ${status}` : "OpenAI API unreachable");
      await sleep(Math.min(8000, 500 * 2 ** attempt));
    }
  }
}

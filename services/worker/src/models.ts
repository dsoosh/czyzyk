import Anthropic from "@anthropic-ai/sdk";
import { OpenAiClient } from "@czyzyk/shared";
import { llmProvider, type WorkerConfig } from "./config.js";
import { AnthropicDocumentChecker, OpenAiDocumentChecker, type DocumentChecker } from "./extraction/documents.js";
import { AnthropicExtractionModel, OpenAiExtractionModel, type ExtractionModel } from "./extraction/model.js";
import { AnthropicTriageModel, OpenAiTriageModel, type TriageModel } from "./extraction/triage.js";

export interface WorkerModels {
  provider: "openai" | "anthropic";
  model: ExtractionModel;
  triage?: TriageModel;
  documents: DocumentChecker;
}

/**
 * Model clients for the worker (llm-provider): OpenAI when OPENAI_API_KEY and
 * OPENAI_EXTRACTION_MODEL are set, otherwise Anthropic. Model names only from configuration.
 */
export function buildModels(config: WorkerConfig): WorkerModels {
  if (llmProvider(config) === "openai") {
    const client = new OpenAiClient(config.OPENAI_API_KEY!, { maxRetries: 4 });
    const extraction = config.OPENAI_EXTRACTION_MODEL!;
    return {
      provider: "openai",
      model: new OpenAiExtractionModel(client, extraction),
      triage: config.OPENAI_TRIAGE_MODEL ? new OpenAiTriageModel(client, config.OPENAI_TRIAGE_MODEL) : undefined,
      documents: new OpenAiDocumentChecker(client, config.OPENAI_DOCUMENT_MODEL ?? extraction),
    };
  }
  const anthropic = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY, maxRetries: 4 });
  const extraction = config.EXTRACTION_MODEL!;
  return {
    provider: "anthropic",
    model: new AnthropicExtractionModel(anthropic, extraction),
    triage: config.TRIAGE_MODEL ? new AnthropicTriageModel(anthropic, config.TRIAGE_MODEL) : undefined,
    documents: new AnthropicDocumentChecker(anthropic, config.DOCUMENT_MODEL ?? extraction),
  };
}

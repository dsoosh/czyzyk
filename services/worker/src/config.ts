import { baseEnvSchema, databaseUrlSchema, loadEnv } from "@czyzyk/shared";
import { z } from "zod";
import { pushEnvShape } from "./push/config.js";

export const workerEnvSchema = baseEnvSchema.extend({
  /** Direct (session) connection string: pg-boss needs a connection it can hold. */
  DATABASE_URL: databaseUrlSchema,
  HEALTH_LOG_INTERVAL_SECONDS: z.coerce.number().int().positive().default(300),

  /** Anthropic, the default provider (llm-provider): key and model names. */
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  /** Model name lives only in configuration (see CLAUDE.md). */
  EXTRACTION_MODEL: z.string().min(1).optional(),
  /** Cheap model asking whether a batch needs the full extraction (message-triage); unset = rules only. */
  TRIAGE_MODEL: z.string().min(1).optional(),
  /** Vision model checking document images for people (document-import); defaults to EXTRACTION_MODEL. */
  DOCUMENT_MODEL: z.string().min(1).optional(),
  /** Seconds between a new message and its extraction; messages arriving meanwhile join the same run. */
  EXTRACTION_DELAY_SECONDS: z.coerce.number().min(0).max(3600).default(15),
  /** Operations below this confidence produce items with status needs_review. */
  EXTRACTION_CONFIDENCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.7),
  /** Already processed messages of the group given to the model as context. */
  EXTRACTION_CONTEXT_MESSAGES: z.coerce.number().int().min(0).max(200).default(50),
  /**
   * OpenAI (llm-provider): with the key and OPENAI_EXTRACTION_MODEL every model call goes to
   * OpenAI; triage only with OPENAI_TRIAGE_MODEL; document checks with OPENAI_DOCUMENT_MODEL
   * (defaults to the extraction model, which must then accept images).
   */
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_EXTRACTION_MODEL: z.string().min(1).optional(),
  OPENAI_TRIAGE_MODEL: z.string().min(1).optional(),
  OPENAI_DOCUMENT_MODEL: z.string().min(1).optional(),
  ...pushEnvShape,
}).superRefine((c, ctx) => {
  if (c.OPENAI_API_KEY && c.OPENAI_EXTRACTION_MODEL) return;
  if (!c.ANTHROPIC_API_KEY) ctx.addIssue({ code: "custom", path: ["ANTHROPIC_API_KEY"], message: "set ANTHROPIC_API_KEY, or OPENAI_API_KEY with OPENAI_EXTRACTION_MODEL" });
  if (!c.EXTRACTION_MODEL) ctx.addIssue({ code: "custom", path: ["EXTRACTION_MODEL"], message: "required for Anthropic" });
});

/** Which provider the worker's model calls go to (llm-provider). */
export function llmProvider(c: Pick<WorkerConfig, "OPENAI_API_KEY" | "OPENAI_EXTRACTION_MODEL">): "openai" | "anthropic" {
  return c.OPENAI_API_KEY && c.OPENAI_EXTRACTION_MODEL ? "openai" : "anthropic";
}

export type WorkerConfig = z.infer<typeof workerEnvSchema>;

export function loadWorkerConfig(source?: Record<string, string | undefined>): WorkerConfig {
  return loadEnv(workerEnvSchema, source);
}

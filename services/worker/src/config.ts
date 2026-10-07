import { baseEnvSchema, databaseUrlSchema, loadEnv } from "@czyzyk/shared";
import { z } from "zod";
import { pushEnvShape } from "./push/config.js";

export const workerEnvSchema = baseEnvSchema.extend({
  /** Direct (session) connection string: pg-boss needs a connection it can hold. */
  DATABASE_URL: databaseUrlSchema,
  HEALTH_LOG_INTERVAL_SECONDS: z.coerce.number().int().positive().default(300),

  ANTHROPIC_API_KEY: z.string().min(1),
  /** Model name lives only in configuration (see CLAUDE.md). */
  EXTRACTION_MODEL: z.string().min(1),
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
  ...pushEnvShape,
});

export type WorkerConfig = z.infer<typeof workerEnvSchema>;

export function loadWorkerConfig(source?: Record<string, string | undefined>): WorkerConfig {
  return loadEnv(workerEnvSchema, source);
}

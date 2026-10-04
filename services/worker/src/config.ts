import { baseEnvSchema, loadEnv } from "@czyzyk/shared";
import { z } from "zod";

export const workerEnvSchema = baseEnvSchema.extend({
  /** Direct (session) connection string: pg-boss needs a connection it can hold. */
  DATABASE_URL: z.string().url(),
  HEALTH_LOG_INTERVAL_SECONDS: z.coerce.number().int().positive().default(300),

  ANTHROPIC_API_KEY: z.string().min(1),
  /** Model name lives only in configuration (see CLAUDE.md). */
  EXTRACTION_MODEL: z.string().min(1),
  /** Minutes of silence in a group before its new messages are extracted. */
  EXTRACTION_DEBOUNCE_MINUTES: z.coerce.number().positive().default(30),
  /** Operations below this confidence produce items with status needs_review. */
  EXTRACTION_CONFIDENCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.7),
  /** Already processed messages of the group given to the model as context. */
  EXTRACTION_CONTEXT_MESSAGES: z.coerce.number().int().min(0).max(200).default(50),
});

export type WorkerConfig = z.infer<typeof workerEnvSchema>;

export function loadWorkerConfig(source?: Record<string, string | undefined>): WorkerConfig {
  return loadEnv(workerEnvSchema, source);
}

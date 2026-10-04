import { baseEnvSchema, loadEnv } from "@czyzyk/shared";
import { z } from "zod";

export const workerEnvSchema = baseEnvSchema.extend({
  /** Direct (session) connection string: pg-boss needs a connection it can hold. */
  DATABASE_URL: z.string().url(),
  HEALTH_LOG_INTERVAL_SECONDS: z.coerce.number().int().positive().default(300),
});

export type WorkerConfig = z.infer<typeof workerEnvSchema>;

export function loadWorkerConfig(source?: Record<string, string | undefined>): WorkerConfig {
  return loadEnv(workerEnvSchema, source);
}

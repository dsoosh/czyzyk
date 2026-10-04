import { baseEnvSchema, loadEnv } from "@czyzyk/shared";
import { z } from "zod";

export const apiEnvSchema = baseEnvSchema.extend({
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default("0.0.0.0"),
});

export type ApiConfig = z.infer<typeof apiEnvSchema>;

export function loadApiConfig(source?: Record<string, string | undefined>): ApiConfig {
  return loadEnv(apiEnvSchema, source);
}

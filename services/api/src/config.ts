import { baseEnvSchema, databaseUrlSchema, loadEnv } from "@czyzyk/shared";
import { z } from "zod";

export const apiEnvSchema = baseEnvSchema.extend({
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default("0.0.0.0"),
  /** Server-side connection (bypasses RLS) – never exposed to clients. */
  DATABASE_URL: databaseUrlSchema,
  INGEST_RATE_LIMIT_PER_TOKEN: z.coerce.number().int().positive().default(120),
  INGEST_RATE_LIMIT_PER_IP: z.coerce.number().int().positive().default(240),
  /** Supabase project URL: issuer and JWKS of user sessions for /push/*. Without it push endpoints answer 503. */
  SUPABASE_URL: z.url().optional(),
  /** Legacy HS256 JWT secret, only for projects without asymmetric signing keys. */
  SUPABASE_JWT_SECRET: z.string().min(32).optional(),
  /** Comma-separated PWA origins allowed to call /push/* from the browser. */
  PWA_ORIGIN: z
    .string()
    .optional()
    .transform((v) => (v ?? "").split(",").map((o) => o.trim().replace(/\/+$/, "")).filter(Boolean)),
});

export type ApiConfig = z.infer<typeof apiEnvSchema>;

export function loadApiConfig(source?: Record<string, string | undefined>): ApiConfig {
  return loadEnv(apiEnvSchema, source);
}

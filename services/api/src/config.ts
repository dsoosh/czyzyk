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
  /** Claude for the view assistant (/assistant/ask). Without the key or the model the endpoint answers 503. */
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  /** Model names live only in configuration (see CLAUDE.md). */
  CHAT_MODEL: z.string().min(1).optional(),
  /** Questions per family member and Warsaw day. */
  ASSISTANT_DAILY_LIMIT: z.coerce.number().int().positive().default(100),
  /** Comma-separated PWA origins (or bare domains) allowed to call /push/* from the browser. */
  PWA_ORIGIN: z
    .string()
    .optional()
    .transform((v) =>
      (v ?? "")
        .split(",")
        .map((o) => o.trim().replace(/\/+$/, ""))
        .filter(Boolean)
        // Railway references give a bare domain.
        .map((o) => (/^https?:\/\//.test(o) ? o : `https://${o}`)),
    ),
});

export type ApiConfig = z.infer<typeof apiEnvSchema>;

export function loadApiConfig(source?: Record<string, string | undefined>): ApiConfig {
  return loadEnv(apiEnvSchema, source);
}

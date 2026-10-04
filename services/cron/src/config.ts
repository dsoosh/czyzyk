import { baseEnvSchema, databaseUrlSchema, loadEnv } from "@czyzyk/shared";
import { z } from "zod";

export const cronEnvSchema = baseEnvSchema.extend({
  /** Direct (session) connection string: pg-boss needs a connection it can hold. */
  DATABASE_URL: databaseUrlSchema,
  /** VAPID key pair (`npm run vapid:generate -w @czyzyk/cron`); the public key also goes to the PWA. */
  VAPID_PUBLIC_KEY: z.string().min(40),
  VAPID_PRIVATE_KEY: z.string().min(20),
  /** Contact for push services: mailto: address or https URL. */
  VAPID_SUBJECT: z.string().regex(/^(mailto:|https:\/\/)/, "mailto: or https://"),
  /** How long after the chosen hour a missed digest may still be sent (e.g. after a restart). */
  DIGEST_WINDOW_MINUTES: z.coerce.number().int().min(5).max(360).default(120),
});

export type CronConfig = z.infer<typeof cronEnvSchema>;

export function loadCronConfig(source?: Record<string, string | undefined>): CronConfig {
  return loadEnv(cronEnvSchema, source);
}

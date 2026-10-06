import { z } from "zod";

/**
 * Web Push settings of the worker (formerly the separate cron service). The VAPID
 * pair is optional: without it the worker runs extraction only and logs that push is off.
 */
export const pushEnvShape = {
  /** VAPID key pair (`npm run vapid:generate -w @czyzyk/worker`); the public key also goes to the PWA. */
  VAPID_PUBLIC_KEY: z.string().min(40).optional(),
  VAPID_PRIVATE_KEY: z.string().min(20).optional(),
  /** Contact for push services: mailto: address or https URL. */
  VAPID_SUBJECT: z.string().regex(/^(mailto:|https:\/\/)/, "mailto: or https://").optional(),
  /** How long after the chosen hour a missed digest may still be sent (e.g. after a restart). */
  DIGEST_WINDOW_MINUTES: z.coerce.number().int().min(5).max(360).default(120),
};

export interface PushConfig {
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string;
  DIGEST_WINDOW_MINUTES: number;
}

/** Push settings when the whole VAPID pair and subject are set, otherwise null (push off). */
export function pushConfig(env: {
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
  DIGEST_WINDOW_MINUTES: number;
}): PushConfig | null {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, DIGEST_WINDOW_MINUTES } = env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) return null;
  return { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, DIGEST_WINDOW_MINUTES };
}

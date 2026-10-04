import { z } from "zod";

export const WA_PACKAGES = ["com.whatsapp", "com.whatsapp.w4b"] as const;

/** POST /ingest/notification – one message read from a WhatsApp notification. */
export const notificationIngestSchema = z.object({
  idempotency_key: z.uuid(),
  group_name: z.string().trim().min(1).max(200),
  author: z.string().trim().min(1).max(200),
  text: z.string().max(20_000),
  sent_at: z.iso.datetime({ offset: true }),
  has_attachment: z.boolean().default(false),
  wa_package: z.enum(WA_PACKAGES),
});
export type NotificationIngest = z.infer<typeof notificationIngestSchema>;

/** POST /ingest/seen-groups – only group names, never message content. */
export const seenGroupsSchema = z.object({
  names: z.array(z.string().trim().min(1).max(200)).min(1).max(100),
});
export type SeenGroups = z.infer<typeof seenGroupsSchema>;

/** GET /ingest/config */
export const ingestConfigSchema = z.object({
  tracked_groups: z.array(z.string()),
  config_ttl_seconds: z.number().int().positive(),
});
export type IngestConfig = z.infer<typeof ingestConfigSchema>;

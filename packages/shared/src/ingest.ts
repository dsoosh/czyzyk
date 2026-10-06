import { z } from "zod";

export const WA_PACKAGES = ["com.whatsapp", "com.whatsapp.w4b"] as const;

/** Invisible formatting characters Android/WhatsApp put around names (bidi isolates, marks, ZWSP…). */
const FORMAT_CHARS = /[\u00AD\u061C\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/gu;

/**
 * One spelling per group name (group-tracking): Unicode NFC, no invisible formatting
 * characters, single spaces, trimmed. Same rule on the phone and in migration 0012.
 */
export function normalizeGroupName(name: string): string {
  return name.normalize("NFC").replace(FORMAT_CHARS, "").replace(/\s+/gu, " ").trim();
}

const groupName = z.string().max(200).transform(normalizeGroupName).pipe(z.string().min(1));

/** POST /ingest/notification – one message read from a WhatsApp notification. */
export const notificationIngestSchema = z.object({
  idempotency_key: z.uuid(),
  group_name: groupName,
  author: z.string().trim().min(1).max(200),
  text: z.string().max(20_000),
  sent_at: z.iso.datetime({ offset: true }),
  has_attachment: z.boolean().default(false),
  wa_package: z.enum(WA_PACKAGES),
});
export type NotificationIngest = z.infer<typeof notificationIngestSchema>;

/** POST /ingest/seen-groups – only group names, never message content. */
export const seenGroupsSchema = z.object({
  names: z.array(groupName).min(1).max(100),
});
export type SeenGroups = z.infer<typeof seenGroupsSchema>;

/** GET /ingest/config */
export const ingestConfigSchema = z.object({
  tracked_groups: z.array(z.string()),
  config_ttl_seconds: z.number().int().positive(),
});
export type IngestConfig = z.infer<typeof ingestConfigSchema>;

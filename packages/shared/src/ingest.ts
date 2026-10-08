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

/** Largest document image the phone sends (JPEG re-encoded on the phone, no EXIF). */
export const MAX_DOCUMENT_IMAGE_BYTES = 1536 * 1024;
const MAX_DOCUMENT_IMAGE_BASE64 = Math.ceil(MAX_DOCUMENT_IMAGE_BYTES / 3) * 4;

/**
 * POST /ingest/document – a photo from a tracked group that the phone screened as an
 * organisational document (document-import): the image when no people were found
 * ("image"), otherwise only the text read on the phone ("text_only"). Photos of people
 * never leave the phone, so "withheld" does not exist here.
 */
export const documentIngestSchema = z
  .object({
    /** The notification message the photo belongs to; with group_name, the new message for an own photo. */
    idempotency_key: z.uuid(),
    /** An own photo shared by hand (no WhatsApp message): the tracked group it goes to. */
    group_name: groupName.optional(),
    /** When it was shared; the time of the new message (with group_name). */
    shared_at: z.iso.datetime({ offset: true }).optional(),
    file_name: z.string().trim().min(1).max(200).regex(/^[^/\\]+$/),
    screening: z.enum(["image", "text_only"]),
    text: z.string().max(20_000),
    image: z.string().max(MAX_DOCUMENT_IMAGE_BASE64).optional(),
  })
  .strict()
  .refine((d) => (d.screening === "image" ? d.image !== undefined : d.image === undefined && d.text.trim() !== ""), {
    message: "image goes with screening image only; text_only needs text",
    path: ["image"],
  });
export type DocumentIngest = z.infer<typeof documentIngestSchema>;

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

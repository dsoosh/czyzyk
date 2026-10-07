import cors from "@fastify/cors";
import { createHash } from "node:crypto";
import { dedupeKey, parseChatExport } from "@czyzyk/shared";
import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { z } from "zod";
import type { RateLimiter } from "../rateLimit.js";
import type { SessionVerifier } from "../push/session.js";

/** Text of `_chat.txt`. Media stay on the device; only documents screened by the phone come along. */
const MAX_TEXT_BYTES = 15 * 1024 * 1024;
const MAX_MESSAGES = 50_000;
const BATCH = 1000;
/** Documents screened on the phone (document-import): a few per export. */
const MAX_DOCUMENTS = 40;
const MAX_IMAGE_BYTES = 1536 * 1024;
const MAX_IMAGE_BASE64 = Math.ceil(MAX_IMAGE_BYTES / 3) * 4;
const MAX_DOCUMENT_TEXT = 20_000;

const documentSchema = z
  .object({
    file_name: z.string().min(1).max(200).regex(/^[^/\\]+$/),
    screening: z.enum(["image", "text_only"]),
    /** Text read on the phone. */
    text: z.string().max(MAX_DOCUMENT_TEXT),
    /** JPEG re-encoded on the phone (no EXIF), base64; only for screening "image". */
    image: z.string().max(MAX_IMAGE_BASE64).optional(),
  })
  .strict()
  .refine((d) => (d.screening === "image" ? d.image !== undefined : d.image === undefined && d.text.trim() !== ""), {
    message: "image only and always with screening image; text_only needs text",
  });

export const importChatSchema = z
  .object({
    group_id: z.uuid(),
    text: z.string().min(1).max(MAX_TEXT_BYTES),
    /** New messages from this many recent days go to extraction; older ones are kept as history. */
    extract_days: z.number().int().min(0).max(3650),
    documents: z.array(documentSchema).max(MAX_DOCUMENTS).optional(),
  })
  .strict();

export interface DocumentSummary {
  accepted: number;
  duplicates: number;
  /** No message with that attachment, or not a JPEG. */
  rejected: number;
}

export interface ImportSummary {
  messages: number;
  inserted: number;
  duplicates: number;
  for_extraction: number;
  skipped_lines: number;
  documents: DocumentSummary;
}

const isJpeg = (b: Buffer) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;

/**
 * Manual import of a WhatsApp chat export (text only) by an admin from the PWA.
 * Messages are matched with the stage 2 key, so notifications and repeated imports
 * never create duplicates. Logs and sync_log hold counts only, never message content.
 */
export async function importRoutes(
  app: FastifyInstance,
  opts: { db: pg.Pool; verify: SessionVerifier | null; origins: string[]; perIp: RateLimiter; now?: () => number },
) {
  const { db } = opts;
  const now = opts.now ?? Date.now;
  await app.register(cors, { origin: opts.origins, methods: ["POST"], allowedHeaders: ["authorization", "content-type"], maxAge: 3600 });

  app.post("/chat", { bodyLimit: MAX_TEXT_BYTES + MAX_DOCUMENTS * (MAX_IMAGE_BASE64 + MAX_DOCUMENT_TEXT * 4) + 64 * 1024 }, async (request, reply) => {
    if (!opts.perIp.hit(`import:${request.ip}`)) return reply.code(429).send({ error: "rate_limited" });
    if (!opts.verify) return reply.code(503).send({ error: "import_not_configured" });
    const header = request.headers.authorization ?? "";
    let userId: string;
    try {
      if (!header.startsWith("Bearer ")) throw new Error("missing token");
      userId = await opts.verify(header.slice(7).trim());
    } catch {
      return reply.code(401).send({ error: "unauthorized" });
    }
    const { rowCount: isAdmin } = await db.query("select 1 from public.profiles where id = $1 and role = 'admin'", [userId]);
    if (!isAdmin) return reply.code(403).send({ error: "forbidden" });

    const parsed = importChatSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_request", fields: [...new Set(parsed.error.issues.map((i) => i.path.join(".")))] });
    }
    const { group_id: groupId, text, extract_days: extractDays, documents = [] } = parsed.data;

    const { rows: groups } = await db.query<{ tracked: boolean }>("select tracked from public.wa_groups where id = $1", [groupId]);
    if (!groups[0]) return reply.code(404).send({ error: "group_not_found" });
    if (!groups[0].tracked) return reply.code(422).send({ error: "group_not_tracked" });

    const { messages, skipped } = parseChatExport(text);
    if (messages.length === 0) return reply.code(422).send({ error: "no_messages" });
    if (messages.length > MAX_MESSAGES) return reply.code(413).send({ error: "too_many_messages" });

    const cutoff = now() - extractDays * 86_400_000;
    const summary: ImportSummary = {
      messages: messages.length,
      inserted: 0,
      duplicates: 0,
      for_extraction: 0,
      skipped_lines: skipped,
      documents: { accepted: 0, duplicates: 0, rejected: 0 },
    };
    const keyOf = (m: (typeof messages)[number]) => dedupeKey({ groupId, author: m.author, sentAt: m.sentAt, text: m.text });

    const client = await db.connect();
    try {
      await client.query("begin");
      for (let i = 0; i < messages.length; i += BATCH) {
        const batch = messages.slice(i, i + BATCH);
        const { rows } = await client.query<{ extract: boolean }>(
          `insert into public.messages
             (group_id, author, sent_at, text, source, dedupe_key, has_attachment, processed_at, received_at)
           select $1, x.author, x.sent_at, x.text, 'export', x.key, x.attachment,
                  case when x.extract then null else now() end,
                  -- A day in the past: the worker's quiet-period scan picks the group up right away.
                  case when x.extract then now() - interval '1 day' else now() end
             from unnest($2::text[], $3::timestamptz[], $4::text[], $5::text[], $6::boolean[], $7::boolean[])
                  as x(author, sent_at, text, key, attachment, extract)
           on conflict do nothing
           returning processed_at is null as extract`,
          [
            groupId,
            batch.map((m) => m.author),
            batch.map((m) => m.sentAt.toISOString()),
            batch.map((m) => m.text),
            batch.map(keyOf),
            batch.map((m) => m.hasAttachment),
            batch.map((m) => m.sentAt.getTime() >= cutoff),
          ],
        );
        summary.inserted += rows.length;
        summary.for_extraction += rows.filter((r) => r.extract).length;
      }
      summary.duplicates = summary.messages - summary.inserted;

      // Attachment file names, also on messages that came earlier from notifications.
      const files = messages.flatMap((m) => m.attachments.map((file) => ({ key: keyOf(m), file })));
      for (let i = 0; i < files.length; i += BATCH) {
        const batch = files.slice(i, i + BATCH);
        await client.query(
          `insert into public.attachments (message_id, file_name)
           select m.id, x.file
             from unnest($2::text[], $3::text[]) as x(key, file)
             join public.messages m on m.group_id = $1 and m.dedupe_key = x.key
           on conflict (message_id, file_name) where file_name is not null do nothing`,
          [groupId, batch.map((f) => f.key), batch.map((f) => f.file)],
        );
      }
      for (const doc of documents) {
        summary.documents[await saveDocument(client, groupId, doc, cutoff)]++;
      }
      await client.query("update public.wa_groups set last_export_at = now() where id = $1", [groupId]);
      await client.query("insert into public.sync_log (kind, status, details) values ('export', 'ok', $1)", [
        { group_id: groupId, origin: "pwa", extract_days: extractDays, ...summary },
      ]);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }

    request.log.info({ groupId, ...summary }, "chat export imported");
    return summary;
  });
}

/**
 * Attaches one phone-screened document to its message. Images wait for the worker's check
 * (doc_status pending); text read on the phone is usable at once. A new document on a message
 * from the extraction period sends that message to extraction again.
 */
async function saveDocument(
  client: pg.PoolClient,
  groupId: string,
  doc: z.infer<typeof documentSchema>,
  cutoff: number,
): Promise<keyof DocumentSummary> {
  const image = doc.image === undefined ? null : Buffer.from(doc.image, "base64");
  if (image && (!isJpeg(image) || image.length > MAX_IMAGE_BYTES)) return "rejected";
  const { rows } = await client.query<{ id: string; screening: string | null; message_id: string; sent_at: Date }>(
    `select a.id, a.screening, m.id as message_id, m.sent_at
       from public.attachments a join public.messages m on m.id = a.message_id
      where m.group_id = $1 and a.file_name = $2
      order by m.sent_at desc limit 1`,
    [groupId, doc.file_name],
  );
  const target = rows[0];
  if (!target) return "rejected";
  if (target.screening !== null) return "duplicates";
  const sha256 = image ? createHash("sha256").update(image).digest("hex") : null;
  if (sha256) {
    const { rowCount } = await client.query("select 1 from public.attachments where sha256 = $1", [sha256]);
    if (rowCount) return "duplicates";
  }
  await client.query(
    `update public.attachments
        set screening = $2, doc_text = nullif(btrim($3), ''), sha256 = $4, mime = $5,
            doc_status = case when $2 = 'image' then 'pending' else 'ready' end
      where id = $1`,
    [target.id, doc.screening, doc.text, sha256, image ? "image/jpeg" : null],
  );
  if (image) {
    await client.query("insert into public.attachment_files (attachment_id, mime, bytes) values ($1, 'image/jpeg', $2)", [target.id, image]);
  }
  if (target.sent_at.getTime() >= cutoff) {
    await client.query(
      `update public.messages set processed_at = null, received_at = least(received_at, now() - interval '1 day')
        where id = $1 and processed_at is not null`,
      [target.message_id],
    );
  }
  return "accepted";
}

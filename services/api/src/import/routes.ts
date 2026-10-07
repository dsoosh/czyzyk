import cors from "@fastify/cors";
import { dedupeKey, parseChatExport } from "@czyzyk/shared";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type pg from "pg";
import { z } from "zod";
import type { RateLimiter } from "../rateLimit.js";
import type { SessionVerifier } from "../push/session.js";

/** Text of `_chat.txt`; the PWA never sends media (they stay on the device). */
const MAX_TEXT_BYTES = 15 * 1024 * 1024;
const MAX_MESSAGES = 50_000;
const BATCH = 1000;

export const importChatSchema = z
  .object({
    group_id: z.uuid(),
    text: z.string().min(1).max(MAX_TEXT_BYTES),
    /** New messages from this many recent days go to extraction; older ones are kept as history. */
    extract_days: z.number().int().min(0).max(3650),
  })
  .strict();

/** Messages copied from WhatsApp and pasted by the admin (manual-entry). */
const MAX_PASTED_TEXT = 20_000;
const MAX_PASTED_MESSAGES = 200;

export const pastedMessagesSchema = z
  .object({
    group_id: z.uuid(),
    text: z.string().trim().min(1).max(MAX_PASTED_TEXT),
    /** For a single message without a WhatsApp header; copied headers carry their own author. */
    author: z.string().trim().max(200).optional(),
    sent_at: z.iso.datetime({ offset: true }).optional(),
  })
  .strict();

/** Author of a pasted message whose sender the admin did not give. */
export const UNKNOWN_AUTHOR = "Nieznany nadawca";

export interface PasteSummary {
  messages: number;
  inserted: number;
  duplicates: number;
}

export interface ImportSummary {
  messages: number;
  inserted: number;
  duplicates: number;
  for_extraction: number;
  skipped_lines: number;
}

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

  /** Admin session from the PWA, or the HTTP error to answer with. */
  const authorize = async (request: FastifyRequest): Promise<{ code: number; error: string } | null> => {
    if (!opts.perIp.hit(`import:${request.ip}`)) return { code: 429, error: "rate_limited" };
    if (!opts.verify) return { code: 503, error: "import_not_configured" };
    const header = request.headers.authorization ?? "";
    let userId: string;
    try {
      if (!header.startsWith("Bearer ")) throw new Error("missing token");
      userId = await opts.verify(header.slice(7).trim());
    } catch {
      return { code: 401, error: "unauthorized" };
    }
    const { rowCount: isAdmin } = await db.query("select 1 from public.profiles where id = $1 and role = 'admin'", [userId]);
    return isAdmin ? null : { code: 403, error: "forbidden" };
  };

  app.post("/chat", { bodyLimit: MAX_TEXT_BYTES + 64 * 1024 }, async (request, reply) => {
    const denied = await authorize(request);
    if (denied) return reply.code(denied.code).send({ error: denied.error });

    const parsed = importChatSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_request", fields: [...new Set(parsed.error.issues.map((i) => i.path.join(".")))] });
    }
    const { group_id: groupId, text, extract_days: extractDays } = parsed.data;

    const { rows: groups } = await db.query<{ tracked: boolean }>("select tracked from public.wa_groups where id = $1", [groupId]);
    if (!groups[0]) return reply.code(404).send({ error: "group_not_found" });
    if (!groups[0].tracked) return reply.code(422).send({ error: "group_not_tracked" });

    const { messages, skipped } = parseChatExport(text);
    if (messages.length === 0) return reply.code(422).send({ error: "no_messages" });
    if (messages.length > MAX_MESSAGES) return reply.code(413).send({ error: "too_many_messages" });

    const cutoff = now() - extractDays * 86_400_000;
    const summary: ImportSummary = { messages: messages.length, inserted: 0, duplicates: 0, for_extraction: 0, skipped_lines: skipped };

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
            batch.map((m) => dedupeKey({ groupId, author: m.author, sentAt: m.sentAt, text: m.text })),
            batch.map((m) => m.hasAttachment),
            batch.map((m) => m.sentAt.getTime() >= cutoff),
          ],
        );
        summary.inserted += rows.length;
        summary.for_extraction += rows.filter((r) => r.extract).length;
      }
      summary.duplicates = summary.messages - summary.inserted;
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

  /**
   * Messages copied from WhatsApp and pasted by the admin (manual-entry). Copied headers
   * ("[18:02, 7.10.2026] Pani Ania: …") give author and time; plain text is one message with
   * the author and time from the form. All go to extraction right away.
   */
  app.post("/message", async (request, reply) => {
    const denied = await authorize(request);
    if (denied) return reply.code(denied.code).send({ error: denied.error });

    const parsed = pastedMessagesSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_request", fields: [...new Set(parsed.error.issues.map((i) => i.path.join(".")))] });
    }
    const { group_id: groupId, text } = parsed.data;

    const { rows: groups } = await db.query<{ tracked: boolean }>("select tracked from public.wa_groups where id = $1", [groupId]);
    if (!groups[0]) return reply.code(404).send({ error: "group_not_found" });
    if (!groups[0].tracked) return reply.code(422).send({ error: "group_not_tracked" });

    const copied = parseChatExport(text).messages;
    const messages = copied.length
      ? copied.map((m) => ({ author: m.author, sentAt: m.sentAt, text: m.text, hasAttachment: m.hasAttachment }))
      : [
          {
            author: parsed.data.author || UNKNOWN_AUTHOR,
            sentAt: parsed.data.sent_at ? new Date(parsed.data.sent_at) : new Date(now()),
            text,
            hasAttachment: false,
          },
        ];
    if (messages.length > MAX_PASTED_MESSAGES) return reply.code(413).send({ error: "too_many_messages" });

    const client = await db.connect();
    let summary: PasteSummary;
    try {
      await client.query("begin");
      const { rowCount } = await client.query(
        `insert into public.messages (group_id, author, sent_at, text, source, dedupe_key, has_attachment, received_at)
         select $1, x.author, x.sent_at, x.text, 'manual', x.key, x.attachment,
                -- A day in the past: the worker's quiet-period scan picks the group up right away.
                now() - interval '1 day'
           from unnest($2::text[], $3::timestamptz[], $4::text[], $5::text[], $6::boolean[]) as x(author, sent_at, text, key, attachment)
         on conflict do nothing`,
        [
          groupId,
          messages.map((m) => m.author),
          messages.map((m) => m.sentAt.toISOString()),
          messages.map((m) => m.text),
          messages.map((m) => dedupeKey({ groupId, author: m.author, sentAt: m.sentAt, text: m.text })),
          messages.map((m) => m.hasAttachment),
        ],
      );
      const inserted = rowCount ?? 0;
      summary = { messages: messages.length, inserted, duplicates: messages.length - inserted };
      await client.query("insert into public.sync_log (kind, status, details) values ('manual', 'ok', $1)", [
        { group_id: groupId, origin: "pwa", copied_headers: copied.length > 0, ...summary },
      ]);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }

    request.log.info({ groupId, ...summary }, "pasted messages added");
    return summary;
  });
}

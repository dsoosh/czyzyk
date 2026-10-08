import { createHash } from "node:crypto";
import {
  dedupeKey,
  documentIngestSchema,
  MAX_DOCUMENT_IMAGE_BYTES,
  notificationIngestSchema,
  seenGroupsSchema,
  type IngestConfig,
} from "@czyzyk/shared";
import type { FastifyInstance } from "fastify";
import type pg from "pg";
import type { z } from "zod";
import type { RateLimiter } from "../rateLimit.js";
import { deviceAuth } from "./deviceAuth.js";

const CONFIG_TTL_SECONDS = 900;

/** Author of the message made for an own photo shared from the phone (document-import). */
export const SHARED_PHOTO_AUTHOR = "Zdjęcie z telefonu";

/** Field paths only: messages may contain message content and must not be echoed or logged. */
function invalid(error: z.ZodError) {
  return { error: "invalid_request", fields: [...new Set(error.issues.map((i) => i.path.join(".") || "(root)"))] };
}

export async function ingestRoutes(
  app: FastifyInstance,
  opts: { db: pg.Pool; limits: { perIp: RateLimiter; perToken: RateLimiter } },
) {
  const { db } = opts;
  app.addHook("preHandler", deviceAuth(db, opts.limits));

  app.get("/config", async (): Promise<IngestConfig> => {
    const { rows } = await db.query<{ wa_name: string }>(
      "select wa_name from public.wa_groups where tracked order by wa_name",
    );
    return { tracked_groups: rows.map((r) => r.wa_name), config_ttl_seconds: CONFIG_TTL_SECONDS };
  });

  // group-tracking: names only, so the admin can choose which groups to track.
  app.post("/seen-groups", async (request, reply) => {
    const parsed = seenGroupsSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send(invalid(parsed.error));
    const names = [...new Set(parsed.data.names)];
    const { rowCount } = await db.query(
      `insert into public.wa_groups (wa_name)
       select unnest($1::text[])
       on conflict (wa_name) do nothing`,
      [names],
    );
    return { received: names.length, new_groups: rowCount ?? 0 };
  });

  app.post("/notification", async (request, reply) => {
    const parsed = notificationIngestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send(invalid(parsed.error));
    const msg = parsed.data;

    const { rows: groups } = await db.query<{ id: string; tracked: boolean }>(
      `insert into public.wa_groups (wa_name) values ($1)
       on conflict (wa_name) do update set wa_name = excluded.wa_name
       returning id, tracked`,
      [msg.group_name],
    );
    const group = groups[0]!;
    if (!group.tracked) return reply.code(422).send({ error: "group_not_tracked" });

    const sentAt = new Date(msg.sent_at);
    const key = dedupeKey({ groupId: group.id, author: msg.author, sentAt, text: msg.text });

    const { rows: inserted } = await db.query<{ id: string }>(
      `insert into public.messages
         (group_id, author, sent_at, text, source, dedupe_key, has_attachment, idempotency_key)
       values ($1, $2, $3, $4, 'notification', $5, $6, $7)
       on conflict do nothing
       returning id`,
      [group.id, msg.author, sentAt, msg.text, key, msg.has_attachment, msg.idempotency_key],
    );
    await db.query("update public.wa_groups set last_notification_at = now() where id = $1", [group.id]);

    if (inserted[0]) {
      request.log.info({ messageId: inserted[0].id, groupId: group.id }, "message ingested");
      return reply.code(201).send({ id: inserted[0].id, duplicate: false });
    }

    const { rows: existing } = await db.query<{ id: string }>(
      `select id from public.messages
        where idempotency_key = $1 or (group_id = $2 and dedupe_key = $3)
        limit 1`,
      [msg.idempotency_key, group.id, key],
    );
    request.log.info({ messageId: existing[0]?.id, groupId: group.id }, "duplicate message");
    return reply.code(200).send({ id: existing[0]?.id, duplicate: true });
  });

  // document-import: a photo the phone screened as an organisational document, for a message
  // it already delivered. 404 until that message arrives (the phone retries).
  app.post("/document", { bodyLimit: Math.ceil(MAX_DOCUMENT_IMAGE_BYTES * 1.4) + 64 * 1024 }, async (request, reply) => {
    const parsed = documentIngestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send(invalid(parsed.error));
    const doc = parsed.data;
    const image = doc.image === undefined ? null : Buffer.from(doc.image, "base64");
    if (image && (!isJpeg(image) || image.length > MAX_DOCUMENT_IMAGE_BYTES)) return reply.code(400).send({ error: "invalid_image" });

    // An own photo shared by hand (no WhatsApp message): the first document makes the message.
    if (doc.group_name) {
      const { rows: groups } = await db.query<{ id: string }>("select id from public.wa_groups where wa_name = $1 and tracked", [doc.group_name]);
      if (!groups[0]) return reply.code(422).send({ error: "group_not_tracked" });
      await db.query(
        `insert into public.messages (group_id, author, sent_at, text, source, dedupe_key, has_attachment, idempotency_key)
         values ($1, $2, $3, '', 'manual', $4, true, $5)
         on conflict do nothing`,
        [groups[0].id, SHARED_PHOTO_AUTHOR, doc.shared_at ? new Date(doc.shared_at) : new Date(), `shared:${doc.idempotency_key}`, doc.idempotency_key],
      );
    }

    const { rows: messages } = await db.query<{ id: string; group_id: string; tracked: boolean }>(
      `select m.id, m.group_id, g.tracked from public.messages m join public.wa_groups g on g.id = m.group_id
        where m.idempotency_key = $1`,
      [doc.idempotency_key],
    );
    const message = messages[0];
    if (!message) return reply.code(404).send({ error: "message_not_found" });
    if (!message.tracked) return reply.code(422).send({ error: "group_not_tracked" });

    const sha256 = image ? createHash("sha256").update(image).digest("hex") : null;
    const client = await db.connect();
    try {
      await client.query("begin");
      const { rows: saved } = await client.query<{ id: string }>(
        `insert into public.attachments (message_id, file_name, mime, screening, doc_text, sha256, doc_status)
         select $1, $2, $3, $4, nullif(btrim($5), ''), $6, case when $4 = 'image' then 'pending' else 'ready' end
          where $6::text is null or not exists (select 1 from public.attachments where sha256 = $6)
         on conflict (message_id, file_name) where file_name is not null do nothing
         returning id`,
        [message.id, doc.file_name, image ? "image/jpeg" : null, doc.screening, doc.text, sha256],
      );
      const attachment = saved[0];
      if (!attachment) {
        await client.query("rollback");
        request.log.info({ messageId: message.id }, "duplicate document");
        return reply.code(200).send({ duplicate: true });
      }
      if (image) {
        await client.query("insert into public.attachment_files (attachment_id, mime, bytes) values ($1, 'image/jpeg', $2)", [attachment.id, image]);
      }
      // The message goes to extraction again, now with its document.
      await client.query(
        `update public.messages set processed_at = null, received_at = now() where id = $1 and processed_at is not null`,
        [message.id],
      );
      await client.query("insert into public.sync_log (kind, status, details) values ('document', 'ok', $1)", [
        { group_id: message.group_id, screening: doc.screening, bytes: image?.length ?? 0 },
      ]);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
    request.log.info({ messageId: message.id, screening: doc.screening }, "document ingested");
    return reply.code(201).send({ duplicate: false });
  });
}

const isJpeg = (b: Buffer) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;

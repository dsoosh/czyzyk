import {
  dedupeKey,
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
}

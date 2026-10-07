import cors from "@fastify/cors";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type pg from "pg";
import { z } from "zod";
import type { RateLimiter } from "../rateLimit.js";
import type { SessionVerifier } from "./session.js";

export const subscribeSchema = z.object({
  endpoint: z.url().refine((u) => u.startsWith("https://"), "must be https").max(1000),
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(100),
  }),
});

export const unsubscribeSchema = z.object({ endpoint: z.string().min(1).max(1000) });

export const settingsSchema = z
  .object({
    digest_enabled: z.boolean(),
    digest_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "HH:MM"),
    alert_closures: z.boolean(),
    alert_actions: z.boolean(),
    alert_payments: z.boolean(),
    // morning-push; optional so an older PWA keeps working (missing = unchanged).
    morning_enabled: z.boolean().optional(),
    morning_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "HH:MM").optional(),
    reminders_enabled: z.boolean().optional(),
  })
  .strict();

declare module "fastify" {
  interface FastifyRequest {
    userId?: string;
  }
}

const invalid = (error: z.ZodError) => ({
  error: "invalid_request",
  fields: [...new Set(error.issues.map((i) => i.path.join(".") || "(root)"))],
});

/**
 * Push subscription and settings for the signed-in family member. The caller is
 * identified by their Supabase session (Authorization: Bearer <access token>).
 */
export async function pushRoutes(
  app: FastifyInstance,
  opts: { db: pg.Pool; verify: SessionVerifier | null; origins: string[]; perIp: RateLimiter },
) {
  const { db } = opts;
  await app.register(cors, {
    origin: opts.origins,
    methods: ["POST", "PUT"],
    allowedHeaders: ["authorization", "content-type"],
    maxAge: 3600,
  });

  app.addHook("preHandler", async (request: FastifyRequest, reply) => {
    if (request.method === "OPTIONS") return;
    if (!opts.perIp.hit(`push:${request.ip}`)) return reply.code(429).send({ error: "rate_limited" });
    if (!opts.verify) return reply.code(503).send({ error: "push_not_configured" });
    const header = request.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    let userId: string;
    try {
      if (!token) throw new Error("missing token");
      userId = await opts.verify(token);
    } catch {
      return reply.code(401).send({ error: "unauthorized" });
    }
    const { rowCount } = await db.query("select 1 from public.profiles where id = $1", [userId]);
    if (!rowCount) return reply.code(403).send({ error: "forbidden" });
    request.userId = userId;
  });

  app.post("/subscribe", async (request, reply) => {
    const parsed = subscribeSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send(invalid(parsed.error));
    const { endpoint, keys } = parsed.data;
    // A browser endpoint belongs to whoever subscribed last on that device.
    await db.query(
      `insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, $2, $3, $4)
       on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`,
      [request.userId, endpoint, keys.p256dh, keys.auth],
    );
    await db.query("insert into public.push_settings (user_id) values ($1) on conflict (user_id) do nothing", [request.userId]);
    return reply.code(201).send({ subscribed: true });
  });

  app.post("/unsubscribe", async (request, reply) => {
    const parsed = unsubscribeSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send(invalid(parsed.error));
    const { rowCount } = await db.query("delete from public.push_subscriptions where endpoint = $1 and user_id = $2", [
      parsed.data.endpoint,
      request.userId,
    ]);
    return { removed: rowCount ?? 0 };
  });

  app.put("/settings", async (request, reply) => {
    const parsed = settingsSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send(invalid(parsed.error));
    const s = parsed.data;
    const { rows } = await db.query(
      `insert into public.push_settings
         (user_id, digest_enabled, digest_time, alert_closures, alert_actions, alert_payments, morning_enabled, morning_time, reminders_enabled)
       values ($1, $2, $3::time, $4, $5, $6, coalesce($7, true), coalesce($8::time, '06:45'), coalesce($9, true))
       on conflict (user_id) do update set
         digest_enabled = excluded.digest_enabled, digest_time = excluded.digest_time,
         alert_closures = excluded.alert_closures, alert_actions = excluded.alert_actions,
         alert_payments = excluded.alert_payments,
         morning_enabled = coalesce($7, push_settings.morning_enabled),
         morning_time = coalesce($8::time, push_settings.morning_time),
         reminders_enabled = coalesce($9, push_settings.reminders_enabled)
       returning digest_enabled, to_char(digest_time, 'HH24:MI') as digest_time, alert_closures, alert_actions, alert_payments,
                 morning_enabled, to_char(morning_time, 'HH24:MI') as morning_time, reminders_enabled`,
      [
        request.userId,
        s.digest_enabled,
        s.digest_time,
        s.alert_closures,
        s.alert_actions,
        s.alert_payments,
        s.morning_enabled ?? null,
        s.morning_time ?? null,
        s.reminders_enabled ?? null,
      ],
    );
    return rows[0];
  });
}

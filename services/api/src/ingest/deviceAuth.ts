import { createHash } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import type pg from "pg";
import type { RateLimiter } from "../rateLimit.js";

declare module "fastify" {
  interface FastifyRequest {
    device?: { id: string };
  }
}

const LAST_SEEN_RESOLUTION_SECONDS = 60;

/**
 * Accepts only a valid, non-revoked device token (device-pairing). Rate limits
 * apply per IP before authentication and per device after it.
 */
export function deviceAuth(db: pg.Pool, limits: { perIp: RateLimiter; perToken: RateLimiter }) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!limits.perIp.hit(`ip:${request.ip}`)) {
      return reply.code(429).send({ error: "rate_limited" });
    }

    const header = request.headers.authorization ?? "";
    const match = /^Bearer ([0-9a-f]{64})$/i.exec(header);
    if (!match) return reply.code(401).send({ error: "unauthorized" });

    const tokenHash = createHash("sha256").update(match[1]!.toLowerCase()).digest("hex");
    // One statement: find the active device and refresh last_seen_at at most once a minute.
    const { rows } = await db.query<{ id: string }>(
      `with d as (
         select id from public.devices where token_hash = $1 and revoked_at is null
       ), touched as (
         update public.devices set last_seen_at = now()
          where id in (select id from d)
            and (last_seen_at is null or last_seen_at < now() - make_interval(secs => $2))
       )
       select id from d`,
      [tokenHash, LAST_SEEN_RESOLUTION_SECONDS],
    );
    const device = rows[0];
    if (!device) return reply.code(401).send({ error: "unauthorized" });

    if (!limits.perToken.hit(`device:${device.id}`)) {
      return reply.code(429).send({ error: "rate_limited" });
    }
    request.device = device;
  };
}

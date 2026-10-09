import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type pg from "pg";
import type { RateLimiter } from "../rateLimit.js";
import { asUser } from "../asUser.js";
import { renderCalendar, type FeedEvent } from "./ics.js";

const TOKEN_FILE = /^([0-9a-f]{64})\.ics$/;
/** How far back the feed reaches; older items rarely matter and keep the file small. */
const HISTORY_DAYS = 90;

/**
 * Only active events and closures, and only fields safe to share with a calendar
 * provider: title, time, place and group name. Never message text or authors.
 */
const FEED_SQL = `
  select case when e.repeat_weekdays is null then e.id::text
              else e.id::text || '-' || to_char(o.starts_at at time zone 'Europe/Warsaw', 'YYYYMMDD') end as id,
         e.updated_at as stamp, e.title as summary, e.location, e.all_day,
         coalesce(g.display_name, g.wa_name) as group_name,
         case when e.all_day then to_char(o.starts_at at time zone 'Europe/Warsaw', 'YYYYMMDD')
              else to_char(o.starts_at at time zone 'Europe/Warsaw', 'YYYYMMDD"T"HH24MISS') end as start_local,
         case when e.all_day then to_char((coalesce(o.ends_at, o.starts_at) at time zone 'Europe/Warsaw')::date + 1, 'YYYYMMDD')
              when o.ends_at is null then null
              else to_char(o.ends_at at time zone 'Europe/Warsaw', 'YYYYMMDD"T"HH24MISS') end as end_local,
         'event' as kind
    -- Recurring events (recurring-events) become one entry per occurrence, closure days skipped.
    from public.event_occurrences((now() at time zone 'Europe/Warsaw')::date - $1::int, (now() at time zone 'Europe/Warsaw')::date + 365) o
    join public.events e on e.id = o.id
    left join public.wa_groups g on g.id = e.group_id
   where e.status = 'active'
     and coalesce(o.ends_at, o.starts_at) >= now() - make_interval(days => $1)
  union all
  select c.id::text, c.updated_at, coalesce('Przedszkole nieczynne: ' || c.reason, 'Przedszkole nieczynne'), null, true,
         coalesce(g.display_name, g.wa_name),
         to_char(c.date_from, 'YYYYMMDD'),
         to_char(c.date_to + 1, 'YYYYMMDD'),
         'closure'
    from public.closures c
    left join public.wa_groups g on g.id = c.group_id
   where c.status = 'active'
     and c.date_to >= (now() at time zone 'Europe/Warsaw')::date - $1
  order by start_local, id`;

export async function loadFeed(db: Pick<pg.Pool, "query">): Promise<FeedEvent[]> {
  const { rows } = await db.query(FEED_SQL, [HISTORY_DAYS]);
  return rows.map((r) => ({
    uid: `${r.id}@czyzyk`,
    stamp: new Date(r.stamp),
    summary: r.summary,
    description: r.group_name ? `Grupa: ${r.group_name}` : "Całe przedszkole",
    location: r.location,
    start: r.start_local,
    end: r.end_local,
    allDay: r.all_day,
  }));
}

export async function icalRoutes(app: FastifyInstance, opts: { db: pg.Pool; perIp: RateLimiter }) {
  const { db } = opts;

  app.get<{ Params: { file: string } }>("/:file", async (request, reply) => {
    if (!opts.perIp.hit(`ical:${request.ip}`)) return reply.code(429).send({ error: "rate_limited" });
    const match = TOKEN_FILE.exec(request.params.file);
    // 404 rather than 401 for every failure: a feed URL must not reveal whether a token ever existed.
    if (!match) return reply.code(404).send({ error: "not_found" });
    const hash = createHash("sha256").update(match[1]!).digest("hex");
    const { rows } = await db.query(
      `select t.user_id from public.ical_tokens t
         join public.profiles p on p.id = t.user_id
        where t.token_hash = $1 and t.revoked_at is null`,
      [hash],
    );
    if (rows.length === 0) return reply.code(404).send({ error: "not_found" });

    // Read as the token's owner (families): only the groups their family sees.
    const body = renderCalendar(await asUser(db, rows[0].user_id, (udb) => loadFeed(udb)), "Czyżyk – przedszkole");
    return reply
      .header("content-type", "text/calendar; charset=utf-8")
      .header("cache-control", "private, max-age=900")
      .header("content-disposition", 'inline; filename="czyzyk.ics"')
      .send(body);
  });
}

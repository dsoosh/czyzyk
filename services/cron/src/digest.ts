import type pg from "pg";
import type { Logger } from "pino";
import { paymentLabel, truncate } from "./format.js";
import { sendToUsers, type DeliverySummary, type PushSender } from "./send.js";

export interface DigestDeps {
  db: pg.Pool;
  sender: PushSender;
  logger: Logger;
  windowMinutes: number;
}

/**
 * Tomorrow's digest text ("Jutro: strój sportowy, 10 zł na teatrzyk"), or null when
 * there is nothing for tomorrow. Only active items; packed and paid ones are left out.
 */
export async function buildDigest(db: Pick<pg.Pool, "query">, tomorrow: string): Promise<string | null> {
  const [closures, events, bring, payments] = await Promise.all([
    db.query<{ reason: string | null }>(
      `select reason from public.closures
        where status = 'active' and $1::date between date_from and date_to order by date_from limit 1`,
      [tomorrow],
    ),
    db.query<{ title: string; all_day: boolean; time: string }>(
      `select title, all_day, to_char(starts_at at time zone 'Europe/Warsaw', 'HH24:MI') as time from public.events
        where status = 'active'
          and starts_at >= ($1::date)::timestamp at time zone 'Europe/Warsaw'
          and starts_at < ($1::date + 1)::timestamp at time zone 'Europe/Warsaw'
        order by starts_at, title`,
      [tomorrow],
    ),
    db.query<{ description: string }>(
      `select description from public.bring_items
        where status = 'active' and due_date = $1::date and packed_at is null order by description`,
      [tomorrow],
    ),
    db.query<{ description: string; amount_pln: string | null }>(
      `select description, amount_pln from public.payments
        where status = 'active' and due_date = $1::date and paid_at is null order by description`,
      [tomorrow],
    ),
  ]);

  const parts: string[] = [];
  const closure = closures.rows[0];
  if (closure) parts.push(closure.reason ? `przedszkole nieczynne (${closure.reason})` : "przedszkole nieczynne");
  for (const e of events.rows) parts.push(e.all_day ? e.title : `${e.title} ${e.time}`);
  for (const b of bring.rows) parts.push(b.description);
  for (const p of payments.rows) parts.push(paymentLabel(p.description, p.amount_pln));
  return parts.length ? truncate(`Jutro: ${parts.join(", ")}`) : null;
}

/**
 * Sends the evening digest to users whose chosen hour (Europe/Warsaw) has come.
 * Each user is claimed for the day before sending, so a user gets at most one
 * digest per day even if runs overlap; empty days are claimed but not sent.
 */
export async function runDigest(deps: DigestDeps, now: Date): Promise<DeliverySummary & { claimed: number; empty: boolean }> {
  const { rows: claimed } = await deps.db.query<{ user_id: string; today: string; tomorrow: string }>(
    `with local as (select ($1::timestamptz at time zone 'Europe/Warsaw') as ts)
     update public.push_settings s
        set digest_sent_on = (select ts::date from local)
      where s.digest_enabled
        and s.digest_sent_on is distinct from (select ts::date from local)
        and (select ts::time from local) - s.digest_time between interval '0' and make_interval(mins => $2)
        and exists (select 1 from public.push_subscriptions p where p.user_id = s.user_id)
     returning s.user_id, to_char((select ts::date from local), 'YYYY-MM-DD') as today,
               to_char((select ts::date from local) + 1, 'YYYY-MM-DD') as tomorrow`,
    [now, deps.windowMinutes],
  );
  const empty = { users: 0, sent: 0, removed: 0, failed: 0 };
  if (claimed.length === 0) return { ...empty, claimed: 0, empty: false };

  const tomorrow = claimed[0]!.tomorrow;
  const body = await buildDigest(deps.db, tomorrow);
  if (!body) {
    deps.logger.info({ claimed: claimed.length }, "digest skipped: nothing for tomorrow");
    return { ...empty, claimed: claimed.length, empty: true };
  }
  const summary = await sendToUsers(
    deps.db,
    deps.sender,
    claimed.map((c) => c.user_id),
    { title: "Czyżyk", body, url: "/", tag: `digest-${tomorrow}` },
    deps.logger,
  );
  return { ...summary, claimed: claimed.length, empty: false };
}

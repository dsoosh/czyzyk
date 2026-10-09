import type pg from "pg";
import type { Logger } from "pino";
import { eventLabel, paymentLabel, truncate } from "./format.js";
import { sendToUsers, type DeliverySummary, type PushSender } from "./send.js";

export interface DigestDeps {
  db: pg.Pool;
  sender: PushSender;
  logger: Logger;
  windowMinutes: number;
}

/**
 * Tomorrow's digest text for one family ("Jutro: strój sportowy, 10 zł na teatrzyk"), or null
 * when there is nothing for tomorrow. Only active items of groups the family sees (families);
 * what the family packed or paid is left out.
 */
export async function buildDigest(db: Pick<pg.Pool, "query">, tomorrow: string, familyId: string): Promise<string | null> {
  const [closures, events, bring, payments] = await Promise.all([
    db.query<{ reason: string | null }>(
      `select reason from public.closures
        where status = 'active' and $1::date between date_from and date_to and public.family_sees_group($2, group_id)
        order by date_from limit 1`,
      [tomorrow, familyId],
    ),
    db.query<{ title: string; all_day: boolean; time: string; location: string | null; meeting_point: string | null }>(
      `select e.title, e.all_day, e.location, e.meeting_point, to_char(o.starts_at at time zone 'Europe/Warsaw', 'HH24:MI') as time
         from public.event_occurrences($1::date, $1::date) o join public.events e on e.id = o.id
        where e.status = 'active' and public.family_sees_item($2, e.group_id, e.extra_group_ids, e.audience, e.child_ids, e.family_id)
        order by o.starts_at, e.title`,
      [tomorrow, familyId],
    ),
    db.query<{ description: string }>(
      `select description from public.bring_items
        where status = 'active' and due_date = $1::date and public.family_sees_item($2, group_id, extra_group_ids, audience, child_ids, family_id)
          and not exists (select 1 from public.item_done d where d.item_type = 'bring_item' and d.item_id = id and d.family_id = $2)
        order by description`,
      [tomorrow, familyId],
    ),
    db.query<{ description: string; amount_pln: string | null }>(
      `select description, amount_pln from public.payments
        where status = 'active' and due_date = $1::date and public.family_sees_item($2, group_id, extra_group_ids, audience, child_ids, family_id)
          and not exists (select 1 from public.item_done d where d.item_type = 'payment' and d.item_id = id and d.family_id = $2)
        order by description`,
      [tomorrow, familyId],
    ),
  ]);

  const parts: string[] = [];
  const closure = closures.rows[0];
  if (closure) parts.push(closure.reason ? `przedszkole nieczynne (${closure.reason})` : "przedszkole nieczynne");
  for (const e of events.rows) parts.push(eventLabel(e));
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
  const { rows: claimed } = await deps.db.query<{ user_id: string; today: string; tomorrow: string; family_id: string | null }>(
    `with local as (select ($1::timestamptz at time zone 'Europe/Warsaw') as ts)
     update public.push_settings s
        set digest_sent_on = (select ts::date from local)
      where s.digest_enabled
        and s.digest_sent_on is distinct from (select ts::date from local)
        and (select ts::time from local) - s.digest_time between interval '0' and make_interval(mins => $2)
        and exists (select 1 from public.push_subscriptions p where p.user_id = s.user_id)
     returning s.user_id, to_char((select ts::date from local), 'YYYY-MM-DD') as today,
               to_char((select ts::date from local) + 1, 'YYYY-MM-DD') as tomorrow,
               (select p.family_id from public.profiles p where p.id = s.user_id) as family_id`,
    [now, deps.windowMinutes],
  );
  const empty = { users: 0, sent: 0, removed: 0, failed: 0 };
  if (claimed.length === 0) return { ...empty, claimed: 0, empty: false };

  const tomorrow = claimed[0]!.tomorrow;
  let summary: DeliverySummary = empty;
  let sentAny = false;
  for (const [familyId, userIds] of byFamily(claimed)) {
    const body = await buildDigest(deps.db, tomorrow, familyId);
    if (!body) continue;
    sentAny = true;
    summary = add(summary, await sendToUsers(deps.db, deps.sender, userIds, { title: "Czyżyk", body, url: "/", tag: `digest-${tomorrow}` }, deps.logger));
  }
  if (!sentAny) deps.logger.info({ claimed: claimed.length }, "digest skipped: nothing for tomorrow");
  return { ...summary, claimed: claimed.length, empty: !sentAny };
}

/** Claimed users grouped by family: each family gets its own text (families). */
function byFamily(rows: { user_id: string; family_id: string | null }[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const r of rows) {
    if (!r.family_id) continue;
    map.set(r.family_id, [...(map.get(r.family_id) ?? []), r.user_id]);
  }
  return map;
}

function add(a: DeliverySummary, b: DeliverySummary): DeliverySummary {
  return { users: a.users + b.users, sent: a.sent + b.sent, removed: a.removed + b.removed, failed: a.failed + b.failed };
}

/**
 * Today's plan for one family's morning ("Dziś: basen 9:00, spakować: strój, kapcie"), or null
 * when there is nothing. What the family packed is left out.
 */
export async function buildMorning(db: Pick<pg.Pool, "query">, today: string, familyId: string): Promise<string | null> {
  const [closures, events, bring] = await Promise.all([
    db.query<{ reason: string | null }>(
      `select reason from public.closures
        where status = 'active' and $1::date between date_from and date_to and public.family_sees_group($2, group_id)
        order by date_from limit 1`,
      [today, familyId],
    ),
    db.query<{ title: string; all_day: boolean; time: string; location: string | null; meeting_point: string | null }>(
      `select e.title, e.all_day, e.location, e.meeting_point, to_char(o.starts_at at time zone 'Europe/Warsaw', 'HH24:MI') as time
         from public.event_occurrences($1::date, $1::date) o join public.events e on e.id = o.id
        where e.status = 'active' and public.family_sees_item($2, e.group_id, e.extra_group_ids, e.audience, e.child_ids, e.family_id)
        order by o.starts_at, e.title`,
      [today, familyId],
    ),
    db.query<{ description: string }>(
      `select description from public.bring_items
        where status = 'active' and due_date = $1::date and public.family_sees_item($2, group_id, extra_group_ids, audience, child_ids, family_id)
          and not exists (select 1 from public.item_done d where d.item_type = 'bring_item' and d.item_id = id and d.family_id = $2)
        order by description`,
      [today, familyId],
    ),
  ]);
  const parts: string[] = [];
  const closure = closures.rows[0];
  if (closure) parts.push(closure.reason ? `przedszkole nieczynne (${closure.reason})` : "przedszkole nieczynne");
  for (const e of events.rows) parts.push(eventLabel(e));
  if (bring.rows.length) parts.push(`spakować: ${bring.rows.map((b) => b.description).join(", ")}`);
  return parts.length ? truncate(`Dziś: ${parts.join(", ")}`) : null;
}

/**
 * One family's deadlines of open payments and answers, today and tomorrow ("Termin dziś: zgoda
 * na wycieczkę. Jutro: składka (20 zł)"), or null. What the family paid or resolved is left out.
 */
export async function buildReminders(db: Pick<pg.Pool, "query">, today: string, familyId: string): Promise<string | null> {
  const [payments, actions] = await Promise.all([
    db.query<{ description: string; amount_pln: string | null; due: string }>(
      `select description, amount_pln, case when due_date = $1::date then 'today' else 'tomorrow' end as due
         from public.payments
        where status = 'active' and due_date between $1::date and $1::date + 1
          and public.family_sees_item($2, group_id, extra_group_ids, audience, child_ids, family_id) and not exists (select 1 from public.item_done d where d.item_type = 'payment' and d.item_id = id and d.family_id = $2)
        order by due_date, description`,
      [today, familyId],
    ),
    db.query<{ question: string; due: string }>(
      `select question, case when due_date = $1::date then 'today' else 'tomorrow' end as due
         from public.action_required
        where status = 'active' and due_date between $1::date and $1::date + 1
          and public.family_sees_item($2, group_id, extra_group_ids, audience, child_ids, null) and not exists (select 1 from public.item_done d where d.item_type = 'action_required' and d.item_id = id and d.family_id = $2)
        order by due_date, question`,
      [today, familyId],
    ),
  ]);
  const labels = (due: string) => [
    ...payments.rows.filter((p) => p.due === due).map((p) => paymentLabel(p.description, p.amount_pln)),
    ...actions.rows.filter((a) => a.due === due).map((a) => a.question),
  ];
  const parts = [
    ...(labels("today").length ? [`Termin dziś: ${labels("today").join(", ")}`] : []),
    ...(labels("tomorrow").length ? [`Termin jutro: ${labels("tomorrow").join(", ")}`] : []),
  ];
  return parts.length ? truncate(parts.join(". ")) : null;
}

/**
 * The morning pushes at each user's morning hour (Europe/Warsaw): today's plan and, as a
 * separate notification, deadlines of today and tomorrow. Each is claimed once a day.
 */
export async function runMorning(deps: DigestDeps, now: Date): Promise<{ plan: DeliverySummary; reminders: DeliverySummary }> {
  const claim = (enabled: string, sentOn: string) =>
    deps.db.query<{ user_id: string; today: string; family_id: string | null }>(
      `with local as (select ($1::timestamptz at time zone 'Europe/Warsaw') as ts)
       update public.push_settings s
          set ${sentOn} = (select ts::date from local)
        where s.${enabled}
          and s.${sentOn} is distinct from (select ts::date from local)
          and (select ts::time from local) - s.morning_time between interval '0' and make_interval(mins => $2)
          and exists (select 1 from public.push_subscriptions p where p.user_id = s.user_id)
       returning s.user_id, to_char((select ts::date from local), 'YYYY-MM-DD') as today,
                 (select p.family_id from public.profiles p where p.id = s.user_id) as family_id`,
      [now, deps.windowMinutes],
    );
  const empty: DeliverySummary = { users: 0, sent: 0, removed: 0, failed: 0 };
  const send = async (
    rows: { user_id: string; today: string; family_id: string | null }[],
    build: (today: string, familyId: string) => Promise<string | null>,
    tag: string,
  ) => {
    if (rows.length === 0) return empty;
    const today = rows[0]!.today;
    let summary = empty;
    for (const [familyId, userIds] of byFamily(rows)) {
      const body = await build(today, familyId);
      if (!body) continue;
      summary = add(summary, await sendToUsers(deps.db, deps.sender, userIds, { title: "Czyżyk", body, url: "/", tag: `${tag}-${today}` }, deps.logger));
    }
    return summary;
  };
  const plan = await send((await claim("morning_enabled", "morning_sent_on")).rows, (d, f) => buildMorning(deps.db, d, f), "morning");
  const reminders = await send((await claim("reminders_enabled", "reminders_sent_on")).rows, (d, f) => buildReminders(deps.db, d, f), "deadlines");
  return { plan, reminders };
}

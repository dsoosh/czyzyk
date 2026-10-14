import type { PushAlertJob } from "@czyzyk/shared";
import type pg from "pg";
import type { Logger } from "pino";
import { dateRange, paymentLabel, shortDate, truncate } from "./format.js";
import { sendToUsers, type DeliverySummary, type PushSender } from "./send.js";

export interface AlertDeps {
  db: pg.Pool;
  sender: PushSender;
  logger: Logger;
}

type AlertKind = "closure" | "action_required" | "payment_due" | "event_new" | "event_changed" | "bring_item_new";

const SETTING: Record<AlertKind, string> = {
  closure: "alert_closures",
  action_required: "alert_actions",
  payment_due: "alert_payments",
  event_new: "alert_events",
  event_changed: "alert_events",
  bring_item_new: "alert_bring_items",
};

/** Item table checked for visibility (family_sees_item) per alert kind; closures go by group. */
const VISIBILITY: Partial<Record<AlertKind, string>> = {
  action_required: "action_required",
  payment_due: "payment",
  event_new: "event",
  event_changed: "event",
  bring_item_new: "bring_item",
};

/** Polish names of event fields in "what changed" (change-alerts); others are left out. */
const EVENT_FIELDS: Record<string, string> = {
  title: "nazwa",
  start: "termin",
  end: "termin",
  all_day: "termin",
  repeat: "termin",
  location: "miejsce",
  meeting_point: "zbiórka",
  drop_offs: "przyprowadzenie",
  schedule: "plan dnia",
  children: "dzieci",
  whole_kindergarten: "grupy",
};

/** "15.10 8:30" or "15.10" for an all-day event; "co tydzień" for a recurring one. */
const EVENT_WHEN = `case when e.repeat_weekdays is not null then 'co tydzień'
       else to_char(e.starts_at at time zone 'Europe/Warsaw', 'FMDD.MM')
         || case when e.all_day then '' else ' ' || to_char(e.starts_at at time zone 'Europe/Warsaw', 'FMHH24:MI') end
     end`;

interface Alert {
  kind: AlertKind;
  body: string;
  groupId: string | null;
  familyId: string | null;
  /** Distinguishes alerts of the same kind and item (a changed event: the change id). */
  ref: string;
}

/** The alert for an item if it (still) qualifies, otherwise null. */
async function describe(
  db: Pick<pg.Pool, "query">,
  job: PushAlertJob,
  now: Date,
): Promise<Alert | null> {
  const today = `(($2::timestamptz) at time zone 'Europe/Warsaw')::date`;
  switch (job.type) {
    case "closure": {
      const { rows } = await db.query(
        `select to_char(date_from, 'YYYY-MM-DD') as date_from, to_char(date_to, 'YYYY-MM-DD') as date_to, reason, group_id
           from public.closures where id = $1 and status = 'active' and date_to >= ${today}`,
        [job.id, now],
      );
      const c = rows[0];
      if (!c) return null;
      const reason = c.reason ? ` (${c.reason})` : "";
      return { kind: "closure", body: `Przedszkole nieczynne ${dateRange(c.date_from, c.date_to)}${reason}`, groupId: c.group_id, familyId: null, ref: "" };
    }
    case "action_required": {
      const { rows } = await db.query(
        `select question, to_char(due_date, 'YYYY-MM-DD') as due_date, group_id from public.action_required
          where id = $1 and status = 'active'
            and (due_date is null or due_date >= ${today})`,
        [job.id, now],
      );
      const a = rows[0];
      if (!a) return null;
      return {
        kind: "action_required",
        body: `Wymaga odpowiedzi: ${a.question}${a.due_date ? ` (do ${shortDate(a.due_date)})` : ""}`,
        groupId: a.group_id,
        familyId: null,
        ref: "",
      };
    }
    case "payment": {
      const { rows } = await db.query(
        `select description, amount_pln, group_id, family_id from public.payments
          where id = $1 and status = 'active' and due_date = ${today} + 1`,
        [job.id, now],
      );
      const p = rows[0];
      if (!p) return null;
      return { kind: "payment_due", body: `Płatność na jutro: ${paymentLabel(p.description, p.amount_pln)}`, groupId: p.group_id, familyId: p.family_id, ref: "" };
    }
    case "event": {
      // Only what the extraction created, changed or cancelled; routine classes stay quiet, and so do
      // events already over.
      const change = job.change;
      if (change !== "created" && change !== "updated" && change !== "cancelled") return null;
      if (change !== "created" && !job.changeId) return null;
      const { rows } = await db.query(
        `select e.title, ${EVENT_WHEN} as "when", e.status, e.group_id, e.family_id,
                (select c.changes from public.item_changes c where c.id = $3 and c.item_id = e.id) as changes
           from public.events e
          where e.id = $1 and not e.in_hours
            and (e.repeat_weekdays is not null
                 or (coalesce(e.ends_at, e.starts_at) at time zone 'Europe/Warsaw')::date >= ${today})`,
        [job.id, now, job.changeId ?? null],
      );
      const e = rows[0];
      if (!e) return null;
      const label = `${e.title} (${e.when})`;
      const base = { groupId: e.group_id, familyId: e.family_id };
      if (change === "created") {
        if (e.status !== "active") return null;
        return { kind: "event_new", body: `Nowe wydarzenie: ${label}`, ...base, ref: "" };
      }
      if (change === "cancelled") {
        if (e.status !== "cancelled") return null;
        return { kind: "event_changed", body: `Odwołane: ${label}`, ...base, ref: job.changeId! };
      }
      if (e.status !== "active" || !e.changes) return null;
      const fields = [...new Set(Object.keys(e.changes as object).flatMap((k) => (EVENT_FIELDS[k] ? [EVENT_FIELDS[k]] : [])))];
      const what = fields.length ? ` (${fields.join(", ")})` : "";
      return { kind: "event_changed", body: `Zmiana w wydarzeniu: ${label}${what}`, ...base, ref: job.changeId! };
    }
    case "bring_item": {
      if (job.change !== "created") return null;
      const { rows } = await db.query(
        `select description, to_char(due_date, 'YYYY-MM-DD') as due_date, group_id, family_id from public.bring_items
          where id = $1 and status = 'active' and (due_date is null or due_date >= ${today})`,
        [job.id, now],
      );
      const b = rows[0];
      if (!b) return null;
      return {
        kind: "bring_item_new",
        body: `Do przyniesienia: ${b.description}${b.due_date ? ` (na ${shortDate(b.due_date)})` : ""}`,
        groupId: b.group_id,
        familyId: b.family_id,
        ref: "",
      };
    }
  }
}

/**
 * Handles one push-alert job: checks the item still qualifies, records the alert in
 * push_alerts_sent (one per item and kind, ever; a changed event once per change) and sends it to
 * users who keep that kind of alert on, whose family sees the item and has not done it yet (families).
 */
export async function handleAlert(deps: AlertDeps, job: PushAlertJob, now: Date): Promise<DeliverySummary | "skipped"> {
  const alert = await describe(deps.db, job, now);
  if (!alert) return "skipped";
  const { rowCount } = await deps.db.query(
    "insert into public.push_alerts_sent (kind, item_id, ref) values ($1, $2, $3) on conflict do nothing",
    [alert.kind, job.id, alert.ref],
  );
  if (!rowCount) return "skipped";
  const visibility = VISIBILITY[alert.kind] ?? null;
  const doneType = visibility === "payment" || visibility === "action_required" || visibility === "bring_item" ? visibility : null;
  const { rows } = await deps.db.query<{ user_id: string }>(
    `select s.user_id from public.push_settings s join public.profiles p on p.id = s.user_id
      where s.${SETTING[alert.kind]}
        and case $5::text
              when 'payment' then exists (
                select 1 from public.payments t
                 where t.id = $4 and public.family_sees_item(p.family_id, t.group_id, t.extra_group_ids, t.audience, t.child_ids, t.family_id))
              when 'action_required' then exists (
                select 1 from public.action_required t
                 where t.id = $4 and public.family_sees_item(p.family_id, t.group_id, t.extra_group_ids, t.audience, t.child_ids, null))
              when 'event' then exists (
                select 1 from public.events t
                 where t.id = $4 and public.family_sees_item(p.family_id, t.group_id, t.extra_group_ids, t.audience, t.child_ids, t.family_id))
              when 'bring_item' then exists (
                select 1 from public.bring_items t
                 where t.id = $4 and public.family_sees_item(p.family_id, t.group_id, t.extra_group_ids, t.audience, t.child_ids, t.family_id))
              else public.family_sees_group(p.family_id, $1::uuid)
            end
        and ($2::uuid is null or p.family_id = $2::uuid)
        and not exists (
          select 1 from public.item_done d where d.item_type = $3 and d.item_id = $4 and d.family_id = p.family_id
        )`,
    [alert.groupId, alert.familyId, doneType, job.id, visibility],
  );
  return sendToUsers(
    deps.db,
    deps.sender,
    rows.map((r) => r.user_id),
    { title: "Czyżyk", body: truncate(alert.body), url: "/", tag: `${alert.kind}-${job.id}${alert.ref ? `-${alert.ref}` : ""}` },
    deps.logger,
  );
}

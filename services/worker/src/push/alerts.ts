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

type AlertKind = "closure" | "action_required" | "payment_due";

const SETTING: Record<AlertKind, string> = {
  closure: "alert_closures",
  action_required: "alert_actions",
  payment_due: "alert_payments",
};

/** The alert for an item if it (still) qualifies, otherwise null. */
async function describe(
  db: Pick<pg.Pool, "query">,
  job: PushAlertJob,
  now: Date,
): Promise<{ kind: AlertKind; body: string; groupId: string | null; familyId: string | null } | null> {
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
      return { kind: "closure", body: `Przedszkole nieczynne ${dateRange(c.date_from, c.date_to)}${reason}`, groupId: c.group_id, familyId: null };
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
      return { kind: "payment_due", body: `Płatność na jutro: ${paymentLabel(p.description, p.amount_pln)}`, groupId: p.group_id, familyId: p.family_id };
    }
  }
}

/**
 * Handles one push-alert job: checks the item still qualifies, records the alert in
 * push_alerts_sent (one per item and kind, ever) and sends it to users who keep
 * that kind of alert on, whose family sees the item and has not done it yet (families).
 */
export async function handleAlert(deps: AlertDeps, job: PushAlertJob, now: Date): Promise<DeliverySummary | "skipped"> {
  const alert = await describe(deps.db, job, now);
  if (!alert) return "skipped";
  const { rowCount } = await deps.db.query(
    "insert into public.push_alerts_sent (kind, item_id) values ($1, $2) on conflict do nothing",
    [alert.kind, job.id],
  );
  if (!rowCount) return "skipped";
  const doneType = alert.kind === "payment_due" ? "payment" : alert.kind === "action_required" ? "action_required" : null;
  const { rows } = await deps.db.query<{ user_id: string }>(
    `select s.user_id from public.push_settings s join public.profiles p on p.id = s.user_id
      where s.${SETTING[alert.kind]}
        and public.family_sees_group(p.family_id, $1::uuid)
        and ($2::uuid is null or p.family_id = $2::uuid)
        and not exists (
          select 1 from public.item_done d where d.item_type = $3 and d.item_id = $4 and d.family_id = p.family_id
        )`,
    [alert.groupId, alert.familyId, doneType, job.id],
  );
  return sendToUsers(
    deps.db,
    deps.sender,
    rows.map((r) => r.user_id),
    { title: "Czyżyk", body: truncate(alert.body), url: "/", tag: `${alert.kind}-${job.id}` },
    deps.logger,
  );
}

import type pg from "pg";
import type { Logger } from "pino";
import { sendToUsers, type DeliverySummary, type PushSender } from "./send.js";

/**
 * Announces new access requests to the admins (families-joining). Each request is claimed
 * (notified_at) before sending, so it is announced once even when the check runs again.
 */
export async function runAccessRequests(deps: { db: pg.Pool; sender: PushSender; logger: Logger }): Promise<DeliverySummary & { requests: number }> {
  const { rows: requests } = await deps.db.query<{ email: string; display_name: string | null }>(
    `update public.access_requests set notified_at = now()
      where status = 'pending' and notified_at is null
      returning email, display_name`,
  );
  let summary: DeliverySummary = { users: 0, sent: 0, removed: 0, failed: 0 };
  if (requests.length === 0) return { ...summary, requests: 0 };

  const { rows: admins } = await deps.db.query<{ id: string }>("select id from public.profiles where role = 'admin'");
  const adminIds = admins.map((a) => a.id);
  for (const r of requests) {
    const who = r.display_name ? `${r.display_name} (${r.email})` : r.email;
    const result = await sendToUsers(
      deps.db,
      deps.sender,
      adminIds,
      { title: "Prośba o dostęp", body: `${who} chce dołączyć do Czyżyka.`, url: "/admin", tag: `access-${r.email}` },
      deps.logger,
    );
    summary = {
      users: result.users,
      sent: summary.sent + result.sent,
      removed: summary.removed + result.removed,
      failed: summary.failed + result.failed,
    };
  }
  return { ...summary, requests: requests.length };
}

/** Announces family invites to the invited person (families-joining), each invite once. */
export async function runFamilyInvites(deps: { db: pg.Pool; sender: PushSender; logger: Logger }): Promise<DeliverySummary & { invites: number }> {
  const { rows: invites } = await deps.db.query<{ id: string; user_id: string | null; inviter: string | null }>(
    `with claimed as (
       update public.family_invites set notified_at = now() where notified_at is null
       returning id, email, invited_by
     )
     select c.id, p.id as user_id,
            coalesce(nullif(btrim(i.display_name), ''), split_part(i.email, '@', 1)) as inviter
       from claimed c
       left join public.profiles p on p.email = c.email
       left join public.profiles i on i.id = c.invited_by`,
  );
  let summary: DeliverySummary = { users: 0, sent: 0, removed: 0, failed: 0 };
  for (const inv of invites) {
    if (!inv.user_id) continue;
    const result = await sendToUsers(
      deps.db,
      deps.sender,
      [inv.user_id],
      {
        title: "Zaproszenie do rodziny",
        body: `${inv.inviter ?? "Ktoś"} zaprasza Cię do swojej rodziny w Czyżyku.`,
        url: "/",
        tag: `invite-${inv.id}`,
      },
      deps.logger,
    );
    summary = {
      users: summary.users + result.users,
      sent: summary.sent + result.sent,
      removed: summary.removed + result.removed,
      failed: summary.failed + result.failed,
    };
  }
  return { ...summary, invites: invites.length };
}

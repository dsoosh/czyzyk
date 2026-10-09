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

import type pg from "pg";
import type { Logger } from "pino";
import webpush from "web-push";

export interface PushPayload {
  title: string;
  body: string;
  /** Path the notification opens. */
  url: string;
  /** Replaces an earlier notification with the same tag. */
  tag: string;
}

export interface Subscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Outcome of one delivery; "gone" means the subscription expired (404/410) and should be deleted. */
export type DeliveryResult = "sent" | "gone" | "failed";

export interface PushSender {
  send(subscription: Subscription, payload: PushPayload): Promise<DeliveryResult>;
}

export function webPushSender(vapid: { subject: string; publicKey: string; privateKey: string }): PushSender {
  return {
    async send(subscription, payload) {
      try {
        await webpush.sendNotification(
          { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
          JSON.stringify(payload),
          { vapidDetails: vapid, TTL: 12 * 3600, urgency: "normal", topic: payload.tag.slice(0, 32).replace(/[^A-Za-z0-9_-]/g, "") },
        );
        return "sent";
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        return status === 404 || status === 410 ? "gone" : "failed";
      }
    },
  };
}

export interface DeliverySummary {
  users: number;
  sent: number;
  removed: number;
  failed: number;
}

/**
 * Sends the payload to every subscription of the given users and deletes
 * subscriptions the push service reports as expired. Logs counts only.
 */
export async function sendToUsers(
  db: Pick<pg.Pool, "query">,
  sender: PushSender,
  userIds: string[],
  payload: PushPayload,
  logger: Logger,
): Promise<DeliverySummary> {
  const summary: DeliverySummary = { users: userIds.length, sent: 0, removed: 0, failed: 0 };
  if (userIds.length === 0) return summary;
  const { rows } = await db.query<Subscription>(
    "select endpoint, p256dh, auth from public.push_subscriptions where user_id = any($1::uuid[])",
    [userIds],
  );
  for (const subscription of rows) {
    const result = await sender.send(subscription, payload);
    if (result === "sent") summary.sent++;
    else if (result === "failed") summary.failed++;
    else {
      await db.query("delete from public.push_subscriptions where endpoint = $1", [subscription.endpoint]);
      summary.removed++;
    }
  }
  logger.info({ tag: payload.tag.split("-")[0], ...summary }, "push delivered");
  return summary;
}

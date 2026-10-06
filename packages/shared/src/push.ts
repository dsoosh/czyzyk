import type { ItemType } from "./extraction.js";

/**
 * pg-boss queue between the worker (producer, after an extraction commits) and
 * the worker's push jobs (consumer, sends Web Push). Both create it with these options;
 * creating an existing queue is a no-op.
 */
export const PUSH_ALERT_QUEUE = "push-alert";
export const PUSH_ALERT_QUEUE_OPTIONS = {
  // At most one queued job per item (singletonKey = type:id); push_alerts_sent makes delivery one-time.
  policy: "stately",
  retryLimit: 3,
  retryDelay: 60,
  retryBackoff: true,
  expireInSeconds: 300,
  // Wakes the consumer as soon as the worker enqueues an alert (consumer: useListenNotify);
  // polling is only a slow fallback.
  notify: true,
} as const;

/** Item types that can trigger an immediate alert (the cron decides whether they qualify). */
export const ALERT_ITEM_TYPES = ["closure", "action_required", "payment"] as const satisfies readonly ItemType[];
export type AlertItemType = (typeof ALERT_ITEM_TYPES)[number];

export interface PushAlertJob {
  type: AlertItemType;
  id: string;
}

export function isAlertItemType(type: ItemType): type is AlertItemType {
  return (ALERT_ITEM_TYPES as readonly ItemType[]).includes(type);
}

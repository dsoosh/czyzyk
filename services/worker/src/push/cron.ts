import { PUSH_ALERT_QUEUE, PUSH_ALERT_QUEUE_OPTIONS, type PushAlertJob } from "@czyzyk/shared";
import type pg from "pg";
import type { PgBoss } from "pg-boss";
import type { Logger } from "pino";
import { BACKGROUND_POLL_SECONDS } from "../polling.js";
import { handleAlert } from "./alerts.js";
import { runDigest } from "./digest.js";
import type { PushSender } from "./send.js";

export const DIGEST_QUEUE = "push-digest";

export interface PushJobs {
  /** Runs the digest check now (the schedule does it every 5 minutes). */
  digestNow(): Promise<Awaited<ReturnType<typeof runDigest>>>;
}

/**
 * Web Push jobs on the worker's pg-boss instance: the evening digest (scheduled every
 * 5 minutes) and push-alert jobs enqueued after extractions.
 */
export async function registerPushJobs(
  boss: PgBoss,
  pool: pg.Pool,
  logger: Logger,
  deps: { sender: PushSender; digestWindowMinutes: number; now?: () => Date; digestSchedule?: string | null },
): Promise<PushJobs> {
  const now = deps.now ?? (() => new Date());
  await boss.createQueue(DIGEST_QUEUE, { policy: "singleton" });
  await boss.createQueue(PUSH_ALERT_QUEUE, PUSH_ALERT_QUEUE_OPTIONS);
  // createQueue leaves an existing queue as it is; turn NOTIFY on for queues created before it existed.
  await boss.updateQueue(PUSH_ALERT_QUEUE, { notify: PUSH_ALERT_QUEUE_OPTIONS.notify });

  const digestNow = () => runDigest({ db: pool, sender: deps.sender, logger, windowMinutes: deps.digestWindowMinutes }, now());
  await boss.work(DIGEST_QUEUE, { pollingIntervalSeconds: BACKGROUND_POLL_SECONDS }, async () => {
    await digestNow();
  });
  if (deps.digestSchedule !== null) await boss.schedule(DIGEST_QUEUE, deps.digestSchedule ?? "*/5 * * * *");

  await boss.work<PushAlertJob>(PUSH_ALERT_QUEUE, { pollingIntervalSeconds: BACKGROUND_POLL_SECONDS }, async (jobs) => {
    for (const job of jobs) await handleAlert({ db: pool, sender: deps.sender, logger }, job.data, now());
  });

  logger.info("push jobs started");
  return { digestNow };
}

import { PUSH_ALERT_QUEUE, PUSH_ALERT_QUEUE_OPTIONS, type PushAlertJob } from "@czyzyk/shared";
import type pg from "pg";
import type { PgBoss } from "pg-boss";
import type { Logger } from "pino";
import { BACKGROUND_POLL_SECONDS } from "../polling.js";
import { runAccessRequests, runFamilyInvites } from "./access.js";
import { handleAlert } from "./alerts.js";
import { runDigest, runMorning } from "./digest.js";
import type { PushSender } from "./send.js";

export const DIGEST_QUEUE = "push-digest";

export interface PushJobs {
  /** Runs the evening digest check now (the schedule does it every 5 minutes). */
  digestNow(): Promise<Awaited<ReturnType<typeof runDigest>>>;
  /** Runs the morning plan and deadline reminders check now (same schedule). */
  morningNow(): Promise<Awaited<ReturnType<typeof runMorning>>>;
  /** Announces new family invites and access requests now (same schedule). */
  accessNow(): Promise<Awaited<ReturnType<typeof runAccessRequests>>>;
}

/**
 * Web Push jobs on the worker's pg-boss instance: family invites, access requests for the admins, the morning
 * plan, deadline reminders and the evening digest (checked every 5 minutes) and push-alert jobs enqueued after extractions.
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

  const digestDeps = { db: pool, sender: deps.sender, logger, windowMinutes: deps.digestWindowMinutes };
  const digestNow = () => runDigest(digestDeps, now());
  const morningNow = () => runMorning(digestDeps, now());
  const accessNow = async () => {
    await runFamilyInvites(digestDeps);
    return runAccessRequests(digestDeps);
  };
  await boss.work(DIGEST_QUEUE, { pollingIntervalSeconds: BACKGROUND_POLL_SECONDS }, async () => {
    await accessNow();
    await morningNow();
    await digestNow();
  });
  if (deps.digestSchedule !== null) await boss.schedule(DIGEST_QUEUE, deps.digestSchedule ?? "*/5 * * * *");

  await boss.work<PushAlertJob>(PUSH_ALERT_QUEUE, { pollingIntervalSeconds: BACKGROUND_POLL_SECONDS }, async (jobs) => {
    for (const job of jobs) await handleAlert({ db: pool, sender: deps.sender, logger }, job.data, now());
  });

  logger.info("push jobs started");
  return { digestNow, morningNow, accessNow };
}

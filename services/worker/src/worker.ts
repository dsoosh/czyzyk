import { isAlertItemType, PUSH_ALERT_QUEUE, PUSH_ALERT_QUEUE_OPTIONS, type PushAlertJob } from "@czyzyk/shared";
import pg from "pg";
import { PgBoss } from "pg-boss";
import type { Logger } from "pino";
import type { WorkerConfig } from "./config.js";
import type { ExtractionModel } from "./extraction/model.js";
import type { DocumentChecker } from "./extraction/documents.js";
import type { TriageModel } from "./extraction/triage.js";
import { runGroupExtraction, type ExtractionDeps } from "./extraction/run.js";
import { listenForMessages } from "./extraction/listen.js";
import { findDueGroups } from "./extraction/scheduler.js";
import { BACKGROUND_POLL_SECONDS, EXTRACTION_POLL_SECONDS } from "./polling.js";
import { registerPushJobs, type PushJobs } from "./push/cron.js";
import type { PushSender } from "./push/send.js";

export const EXTRACT_QUEUE = "extract-group";
export const SCAN_QUEUE = "extraction-scan";

export interface RunningWorker {
  boss: PgBoss;
  /** Returns true when the job queue answers. */
  healthy(): Promise<boolean>;
  /** Enqueues extraction for every group with messages older than the delay (runs every minute). */
  scanNow(): Promise<string[]>;
  /** Resolves once the realtime listener is active. */
  listening: Promise<void>;
  /** Web Push jobs (digest, alerts), or null when push is not configured. */
  push: PushJobs | null;
  stop(): Promise<void>;
}

export type WorkerSettings = Pick<
  WorkerConfig,
  | "DATABASE_URL"
  | "HEALTH_LOG_INTERVAL_SECONDS"
  | "EXTRACTION_DELAY_SECONDS"
  | "EXTRACTION_CONFIDENCE_THRESHOLD"
  | "EXTRACTION_CONTEXT_MESSAGES"
>;

export async function startWorker(
  config: WorkerSettings,
  logger: Logger,
  deps: {
    model: ExtractionModel;
    /** Server-side check of document images (document-import). */
    documents?: DocumentChecker;
    /** Cheap first look at a batch (message-triage). */
    triage?: TriageModel;
    now?: () => Date;
    scanSchedule?: string | null;
    /** Web Push (formerly the separate cron service); absent = push off. */
    push?: { sender: PushSender; digestWindowMinutes: number; digestSchedule?: string | null } | null;
  },
): Promise<RunningWorker> {
  const now = deps.now ?? (() => new Date());
  const pool = new pg.Pool({ connectionString: config.DATABASE_URL, max: 5 });
  // LISTEN/NOTIFY wakes workers of notify-enabled queues (push alerts) at once; others poll.
  const boss = new PgBoss({ connectionString: config.DATABASE_URL, useListenNotify: true });
  boss.on("error", (error) => logger.error({ err: error }, "pg-boss error"));
  await boss.start();

  // stately: at most one queued and one active job per group (singletonKey = group id).
  // Failed extractions retry with exponential backoff; messages stay unprocessed meanwhile.
  await boss.createQueue(EXTRACT_QUEUE, {
    policy: "stately",
    retryLimit: 8,
    retryDelay: 30,
    retryBackoff: true,
    retryDelayMax: 1800,
    expireInSeconds: 600,
  });
  await boss.createQueue(SCAN_QUEUE, { policy: "short" });
  await boss.createQueue(PUSH_ALERT_QUEUE, PUSH_ALERT_QUEUE_OPTIONS);

  const extractionDeps: ExtractionDeps = {
    db: pool,
    model: deps.model,
    documents: deps.documents,
    triage: deps.triage,
    logger,
    now,
    confidenceThreshold: config.EXTRACTION_CONFIDENCE_THRESHOLD,
    contextMessages: config.EXTRACTION_CONTEXT_MESSAGES,
    // The push jobs (src/push) decide whether an item deserves an alert and send it at most once.
    onActiveItems: async (items) => {
      for (const item of items) {
        if (!isAlertItemType(item.type)) continue;
        const job: PushAlertJob = { type: item.type, id: item.id };
        await boss.send(PUSH_ALERT_QUEUE, job, { singletonKey: `${item.type}:${item.id}` });
      }
    },
  };

  await boss.work<{ groupId: string }>(EXTRACT_QUEUE, { pollingIntervalSeconds: EXTRACTION_POLL_SECONDS }, async (jobs) => {
    for (const job of jobs) await runGroupExtraction(extractionDeps, job.data.groupId);
  });

  // Realtime: a new message wakes the group's extraction after a short delay. With the stately
  // policy a group has at most one waiting job, so a burst of messages joins one run, and a
  // message arriving during a run queues the next one.
  const enqueue = async (groupId: string, startAfter: number) => {
    await boss.send(EXTRACT_QUEUE, { groupId }, { singletonKey: groupId, startAfter });
  };
  const listener = listenForMessages(config.DATABASE_URL, (groupId) => enqueue(groupId, config.EXTRACTION_DELAY_SECONDS), logger);

  const scanNow = async () => {
    const due = await findDueGroups(pool, config.EXTRACTION_DELAY_SECONDS, now());
    for (const groupId of due) await enqueue(groupId, 0);
    if (due.length) logger.info({ groups: due.length }, "extraction enqueued");
    return due;
  };
  await boss.work(SCAN_QUEUE, { pollingIntervalSeconds: BACKGROUND_POLL_SECONDS }, async () => {
    await scanNow();
  });
  if (deps.scanSchedule !== null) await boss.schedule(SCAN_QUEUE, deps.scanSchedule ?? "* * * * *");

  // One process for extraction and push keeps a single pg-boss instance and connection pool.
  const push = deps.push ? await registerPushJobs(boss, pool, logger, { ...deps.push, now }) : null;
  if (!push) logger.warn("push not configured (VAPID_* missing): digest and alerts are off");

  const healthy = async () => {
    try {
      await boss.getQueues();
      return true;
    } catch {
      return false;
    }
  };

  const timer = setInterval(() => {
    void healthy().then((ok) => logger.info({ healthy: ok }, "worker heartbeat"));
  }, config.HEALTH_LOG_INTERVAL_SECONDS * 1000);
  timer.unref();

  logger.info("worker started");

  return {
    boss,
    healthy,
    scanNow,
    listening: listener.ready,
    push,
    async stop() {
      clearInterval(timer);
      await listener.stop();
      await boss.stop({ graceful: true, timeout: 30_000 });
      await pool.end();
      logger.info("worker stopped");
    },
  };
}

import pg from "pg";
import { PgBoss } from "pg-boss";
import type { Logger } from "pino";
import type { WorkerConfig } from "./config.js";
import type { ExtractionModel } from "./extraction/model.js";
import { runGroupExtraction, type ExtractionDeps } from "./extraction/run.js";
import { findDueGroups } from "./extraction/scheduler.js";

export const EXTRACT_QUEUE = "extract-group";
export const SCAN_QUEUE = "extraction-scan";

export interface RunningWorker {
  boss: PgBoss;
  /** Returns true when the job queue answers. */
  healthy(): Promise<boolean>;
  /** Enqueues extraction for every group past its quiet period (runs every minute). */
  scanNow(): Promise<string[]>;
  stop(): Promise<void>;
}

export type WorkerSettings = Pick<
  WorkerConfig,
  | "DATABASE_URL"
  | "HEALTH_LOG_INTERVAL_SECONDS"
  | "EXTRACTION_DEBOUNCE_MINUTES"
  | "EXTRACTION_CONFIDENCE_THRESHOLD"
  | "EXTRACTION_CONTEXT_MESSAGES"
>;

export async function startWorker(
  config: WorkerSettings,
  logger: Logger,
  deps: { model: ExtractionModel; now?: () => Date; scanSchedule?: string | null },
): Promise<RunningWorker> {
  const now = deps.now ?? (() => new Date());
  const pool = new pg.Pool({ connectionString: config.DATABASE_URL, max: 5 });
  const boss = new PgBoss(config.DATABASE_URL);
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

  const extractionDeps: ExtractionDeps = {
    db: pool,
    model: deps.model,
    logger,
    now,
    confidenceThreshold: config.EXTRACTION_CONFIDENCE_THRESHOLD,
    contextMessages: config.EXTRACTION_CONTEXT_MESSAGES,
  };

  await boss.work<{ groupId: string }>(EXTRACT_QUEUE, async (jobs) => {
    for (const job of jobs) await runGroupExtraction(extractionDeps, job.data.groupId);
  });

  const scanNow = async () => {
    const due = await findDueGroups(pool, config.EXTRACTION_DEBOUNCE_MINUTES, now());
    for (const groupId of due) await boss.send(EXTRACT_QUEUE, { groupId }, { singletonKey: groupId });
    if (due.length) logger.info({ groups: due.length }, "extraction enqueued");
    return due;
  };
  await boss.work(SCAN_QUEUE, async () => {
    await scanNow();
  });
  if (deps.scanSchedule !== null) await boss.schedule(SCAN_QUEUE, deps.scanSchedule ?? "* * * * *");

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
    async stop() {
      clearInterval(timer);
      await boss.stop({ graceful: true, timeout: 30_000 });
      await pool.end();
      logger.info("worker stopped");
    },
  };
}

import { PUSH_ALERT_QUEUE, PUSH_ALERT_QUEUE_OPTIONS, type PushAlertJob } from "@czyzyk/shared";
import pg from "pg";
import { PgBoss } from "pg-boss";
import type { Logger } from "pino";
import { handleAlert } from "./alerts.js";
import type { CronConfig } from "./config.js";
import { runDigest } from "./digest.js";
import type { PushSender } from "./send.js";

export const DIGEST_QUEUE = "push-digest";

export interface RunningCron {
  /** Runs the digest check now (the schedule does it every 5 minutes). */
  digestNow(): Promise<Awaited<ReturnType<typeof runDigest>>>;
  stop(): Promise<void>;
}

export async function startCron(
  config: Pick<CronConfig, "DATABASE_URL" | "DIGEST_WINDOW_MINUTES">,
  logger: Logger,
  deps: { sender: PushSender; now?: () => Date; digestSchedule?: string | null },
): Promise<RunningCron> {
  const now = deps.now ?? (() => new Date());
  const pool = new pg.Pool({ connectionString: config.DATABASE_URL, max: 3 });
  const boss = new PgBoss(config.DATABASE_URL);
  boss.on("error", (error) => logger.error({ err: error }, "pg-boss error"));
  await boss.start();

  await boss.createQueue(DIGEST_QUEUE, { policy: "singleton" });
  await boss.createQueue(PUSH_ALERT_QUEUE, PUSH_ALERT_QUEUE_OPTIONS);

  const digestNow = () => runDigest({ db: pool, sender: deps.sender, logger, windowMinutes: config.DIGEST_WINDOW_MINUTES }, now());
  await boss.work(DIGEST_QUEUE, async () => {
    await digestNow();
  });
  if (deps.digestSchedule !== null) await boss.schedule(DIGEST_QUEUE, deps.digestSchedule ?? "*/5 * * * *");

  await boss.work<PushAlertJob>(PUSH_ALERT_QUEUE, async (jobs) => {
    for (const job of jobs) await handleAlert({ db: pool, sender: deps.sender, logger }, job.data, now());
  });

  logger.info("cron started");
  return {
    digestNow,
    async stop() {
      await boss.stop({ graceful: true, timeout: 10_000 });
      await pool.end();
    },
  };
}

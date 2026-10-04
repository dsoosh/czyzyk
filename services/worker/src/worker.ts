import { PgBoss } from "pg-boss";
import type { Logger } from "pino";
import type { WorkerConfig } from "./config.js";

export interface RunningWorker {
  boss: PgBoss;
  /** Returns true when the job queue answers. */
  healthy(): Promise<boolean>;
  stop(): Promise<void>;
}

/**
 * Starts the job queue. Queues and handlers are registered by later stages
 * (extraction, export import); stage 1 only proves the process runs.
 */
export async function startWorker(
  config: Pick<WorkerConfig, "DATABASE_URL" | "HEALTH_LOG_INTERVAL_SECONDS">,
  logger: Logger,
): Promise<RunningWorker> {
  const boss = new PgBoss(config.DATABASE_URL);
  boss.on("error", (error) => logger.error({ err: error }, "pg-boss error"));
  await boss.start();

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
    async stop() {
      clearInterval(timer);
      await boss.stop({ graceful: true, timeout: 30_000 });
      logger.info("worker stopped");
    },
  };
}

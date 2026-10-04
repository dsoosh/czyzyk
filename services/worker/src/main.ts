import { pino } from "pino";
import { loadWorkerConfig } from "./config.js";
import { startWorker } from "./worker.js";

const config = loadWorkerConfig();
// Never log message contents: log objects carry ids, counts and statuses only.
const logger = pino({ level: config.LOG_LEVEL });
const worker = await startWorker(config, logger);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    logger.info({ signal }, "shutting down");
    void worker.stop().then(() => process.exit(0));
  });
}

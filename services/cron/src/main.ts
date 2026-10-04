import { pino } from "pino";
import { loadCronConfig } from "./config.js";
import { startCron } from "./cron.js";
import { webPushSender } from "./send.js";

const config = loadCronConfig();
// Never log notification bodies: they are built from group messages.
const logger = pino({ level: config.LOG_LEVEL });
const cron = await startCron(config, logger, {
  sender: webPushSender({ subject: config.VAPID_SUBJECT, publicKey: config.VAPID_PUBLIC_KEY, privateKey: config.VAPID_PRIVATE_KEY }),
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    logger.info({ signal }, "shutting down");
    void cron.stop().then(() => process.exit(0));
  });
}

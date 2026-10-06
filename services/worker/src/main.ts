import Anthropic from "@anthropic-ai/sdk";
import { pino } from "pino";
import { loadWorkerConfig } from "./config.js";
import { AnthropicExtractionModel } from "./extraction/model.js";
import { pushConfig } from "./push/config.js";
import { webPushSender } from "./push/send.js";
import { startWorker } from "./worker.js";

const config = loadWorkerConfig();
// Never log message contents: log objects carry ids, counts and statuses only.
const logger = pino({ level: config.LOG_LEVEL });
const anthropic = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY, maxRetries: 4 });
const push = pushConfig(config);
const worker = await startWorker(config, logger, {
  model: new AnthropicExtractionModel(anthropic, config.EXTRACTION_MODEL),
  push: push && {
    sender: webPushSender({ subject: push.VAPID_SUBJECT, publicKey: push.VAPID_PUBLIC_KEY, privateKey: push.VAPID_PRIVATE_KEY }),
    digestWindowMinutes: push.DIGEST_WINDOW_MINUTES,
  },
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    logger.info({ signal }, "shutting down");
    void worker.stop().then(() => process.exit(0));
  });
}

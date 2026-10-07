import Anthropic from "@anthropic-ai/sdk";
import pg from "pg";
import { buildApp } from "./app.js";
import { OpenAiClient } from "@czyzyk/shared";
import { assistantModelFrom } from "./assistant/model.js";
import { loadApiConfig } from "./config.js";

const config = loadApiConfig();
const db = new pg.Pool({ connectionString: config.DATABASE_URL, max: 5 });
const assistantModel = assistantModelFrom(config, {
  openai: (apiKey) => new OpenAiClient(apiKey, { maxRetries: 2 }),
  anthropic: (apiKey) => new Anthropic({ apiKey, maxRetries: 2 }),
});
const app = buildApp(config, { db, assistantModel });

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    app.log.info({ signal }, "shutting down");
    void app
      .close()
      .then(() => db.end())
      .then(() => process.exit(0));
  });
}

await app.listen({ port: config.PORT, host: config.HOST });

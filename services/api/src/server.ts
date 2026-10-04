import { buildApp } from "./app.js";
import { loadApiConfig } from "./config.js";

const config = loadApiConfig();
const app = buildApp(config);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    app.log.info({ signal }, "shutting down");
    void app.close().then(() => process.exit(0));
  });
}

await app.listen({ port: config.PORT, host: config.HOST });

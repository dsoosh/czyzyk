import pg from "pg";
import { buildApp } from "./app.js";
import { loadApiConfig } from "./config.js";

const config = loadApiConfig();
const db = new pg.Pool({ connectionString: config.DATABASE_URL, max: 5 });
const app = buildApp(config, { db });

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

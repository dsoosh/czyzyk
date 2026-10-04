import Fastify, { type FastifyInstance } from "fastify";
import type { ApiConfig } from "./config.js";

/**
 * Builds the API. Logs carry only request metadata (method, route, status, timing):
 * bodies and credentials are never logged because they may hold group messages.
 */
export function buildApp(config: Pick<ApiConfig, "LOG_LEVEL" | "NODE_ENV">): FastifyInstance {
  const app = Fastify({
    logger:
      config.NODE_ENV === "test"
        ? false
        : {
            level: config.LOG_LEVEL,
            redact: ["req.headers.authorization", "req.headers.cookie"],
            serializers: {
              req: (req) => ({ method: req.method, route: req.routeOptions?.url ?? "unknown" }),
            },
          },
    trustProxy: true,
  });

  app.get("/health", async () => ({ status: "ok" }));

  return app;
}

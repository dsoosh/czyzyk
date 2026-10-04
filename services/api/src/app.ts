import Fastify, { type FastifyInstance } from "fastify";
import type pg from "pg";
import type { DestinationStream } from "pino";
import type { ApiConfig } from "./config.js";
import { icalRoutes } from "./ical/routes.js";
import { ingestRoutes } from "./ingest/routes.js";
import { RateLimiter } from "./rateLimit.js";

export interface AppDeps {
  db: pg.Pool;
  /** Overrides the log destination (tests inspect what gets logged). */
  logStream?: DestinationStream;
  now?: () => number;
}

/**
 * Builds the API. Logs carry only request metadata (method, route, status, timing)
 * and ids: bodies and credentials are never logged because they hold group messages.
 */
export function buildApp(
  config: Pick<ApiConfig, "LOG_LEVEL" | "NODE_ENV" | "INGEST_RATE_LIMIT_PER_IP" | "INGEST_RATE_LIMIT_PER_TOKEN">,
  deps: AppDeps,
): FastifyInstance {
  const silent = config.NODE_ENV === "test" && !deps.logStream;
  const app = Fastify({
    logger: silent
      ? false
      : {
          level: config.LOG_LEVEL,
          stream: deps.logStream,
          redact: ["req.headers.authorization", "req.headers.cookie"],
          serializers: {
            req: (req) => ({ method: req.method, route: req.routeOptions?.url ?? "unknown" }),
          },
        },
    trustProxy: true,
    bodyLimit: 256 * 1024,
  });

  app.get("/health", async () => ({ status: "ok" }));

  const limits = {
    perIp: new RateLimiter(config.INGEST_RATE_LIMIT_PER_IP, deps.now),
    perToken: new RateLimiter(config.INGEST_RATE_LIMIT_PER_TOKEN, deps.now),
  };
  app.register(ingestRoutes, { prefix: "/ingest", db: deps.db, limits });
  app.register(icalRoutes, { prefix: "/ical", db: deps.db, perIp: new RateLimiter(config.INGEST_RATE_LIMIT_PER_IP, deps.now) });

  return app;
}

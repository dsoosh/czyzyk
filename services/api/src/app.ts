import Fastify, { type FastifyInstance } from "fastify";
import type pg from "pg";
import type { DestinationStream } from "pino";
import type { ApiConfig } from "./config.js";
import { icalRoutes } from "./ical/routes.js";
import { importRoutes } from "./import/routes.js";
import { ingestRoutes } from "./ingest/routes.js";
import { pushRoutes } from "./push/routes.js";
import { createSessionVerifier, type SessionVerifier } from "./push/session.js";
import { RateLimiter } from "./rateLimit.js";

export interface AppDeps {
  db: pg.Pool;
  /** Overrides the log destination (tests inspect what gets logged). */
  logStream?: DestinationStream;
  now?: () => number;
  /** Overrides session verification for /push/* (tests verify against a local key set). */
  verifySession?: SessionVerifier;
}

/**
 * Builds the API. Logs carry only request metadata (method, route, status, timing)
 * and ids: bodies and credentials are never logged because they hold group messages.
 */
export function buildApp(
  config: Pick<ApiConfig, "LOG_LEVEL" | "NODE_ENV" | "INGEST_RATE_LIMIT_PER_IP" | "INGEST_RATE_LIMIT_PER_TOKEN"> &
    Partial<Pick<ApiConfig, "SUPABASE_URL" | "SUPABASE_JWT_SECRET" | "PWA_ORIGIN">>,
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
  const verify =
    deps.verifySession ??
    (config.SUPABASE_URL
      ? createSessionVerifier({ supabaseUrl: config.SUPABASE_URL, jwtSecret: config.SUPABASE_JWT_SECRET })
      : null);
  app.register(pushRoutes, {
    prefix: "/push",
    db: deps.db,
    verify,
    origins: config.PWA_ORIGIN ?? [],
    perIp: new RateLimiter(config.INGEST_RATE_LIMIT_PER_IP, deps.now),
  });
  app.register(importRoutes, {
    prefix: "/import",
    db: deps.db,
    verify,
    origins: config.PWA_ORIGIN ?? [],
    perIp: new RateLimiter(30, deps.now),
    now: deps.now,
  });
  app.register(icalRoutes, { prefix: "/ical", db: deps.db, perIp: new RateLimiter(config.INGEST_RATE_LIMIT_PER_IP, deps.now) });

  return app;
}

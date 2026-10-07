/**
 * Railway infrastructure as code for Czyżyk (replaces the per-service railway.json
 * Config as Code files, which Railway stops reading on 2026-12-01).
 *
 *   railway link                # once, in the repository root
 *   railway config plan         # preview the diff against the linked environment
 *   railway config apply        # apply (prompts before destructive changes)
 *
 * Database migrations run as the pre-deploy command of api and worker (Railway runs it
 * after the build, before the new version takes traffic; a failure stops the deploy).
 * scripts/migrate.mjs is idempotent and takes an advisory lock, so every service may run it.
 *
 * Secrets are never committed: variables marked preserve() keep the value already
 * stored in Railway (set them once in the dashboard or with `railway variables --set`).
 * Apply is declarative – a variable missing here would be deleted, so every variable
 * a service uses is listed, secret or not.
 */
import { defineRailway, github, group, preserve, project, resourceAddress, service, type VariableValue } from "railway/iac";

const REPO = "dsoosh/czyzyk";

/** Applies pending supabase/migrations with DATABASE_URL before the new version starts. */
const MIGRATE = "npm run db:migrate";

type ServiceKey = "api" | "worker" | "pwa";

/**
 * Railway service names. They match the services Railway created from the monorepo
 * (named after the npm workspaces); Railway matches IaC resources by name and has no
 * rename, so other names would delete those services with their variables and domains.
 */
const NAME = (key: ServiceKey) => `@czyzyk/${key}`;

/**
 * Reference to another service's variable, resolved by Railway. Structured rather than a
 * "${{name.VAR}}" string, because the service names contain "@" and "/".
 */
const refTo = (key: ServiceKey, output: string): VariableValue => ({
  type: "reference",
  resource: resourceAddress("service", NAME(key)),
  output,
});

/** Every service builds from the repository root; CZYZYK_SERVICE picks what to build and start. */
const fromMonorepo = (name: ServiceKey, watch: string[]) => ({
  source: github(REPO, { branch: "main" }),
  build: {
    builder: "RAILPACK" as const,
    buildCommand: "npm run build",
    // Rebuild only when this service, the shared package or the dependency set changes.
    watchPatterns: [...watch, "package.json", "package-lock.json", "scripts/service.mjs"],
  },
  start: "npm start",
  // No NODE_ENV=production here: it is visible at build time and would make
  // `npm ci` skip the dev dependencies (TypeScript, Vite) the build needs.
  env: { CZYZYK_SERVICE: name },
});

/**
 * Node services start their entry point directly: `npm start` would keep three extra
 * processes alive (npm → scripts/service.mjs → npm -w), each tens of MB of billed RAM.
 * The heap cap keeps an idle service small.
 */
const node = (entry: string) => `node --max-old-space-size=256 ${entry}`;

export default defineRailway(() => {
  const apiBase = fromMonorepo("api", ["services/api/**", "packages/shared/**", "supabase/migrations/**", "scripts/migrate.mjs"]);
  const api = service(NAME("api"), {
    ...apiBase,
    start: node("services/api/dist/server.js"),
    preDeploy: MIGRATE,
    healthcheck: "/health",
    healthcheckTimeout: 60,
    deploy: { restartPolicyType: "ON_FAILURE", restartPolicyMaxRetries: 10 },
    env: {
      ...apiBase.env,
      LOG_LEVEL: "info",
      // Supabase Postgres, session pooler (port 5432). Server-side only.
      DATABASE_URL: preserve(),
      INGEST_RATE_LIMIT_PER_TOKEN: "120",
      INGEST_RATE_LIMIT_PER_IP: "240",
      // Push endpoints verify Supabase sessions (JWKS of this project) and accept browser calls from the PWA only.
      SUPABASE_URL: refTo("pwa", "VITE_SUPABASE_URL"),
      // A bare domain; the API adds https://.
      PWA_ORIGIN: refTo("pwa", "RAILWAY_PUBLIC_DOMAIN"),
      // View assistant. Model names live in configuration, never in code (CLAUDE.md).
      ANTHROPIC_API_KEY: preserve(),
      CHAT_MODEL: "claude-sonnet-5-5",
      // OpenAI instead of Claude (llm-provider) once both are set in Railway; unset = Claude.
      OPENAI_API_KEY: preserve(),
      OPENAI_CHAT_MODEL: preserve(),
      ASSISTANT_DAILY_LIMIT: "100",
    },
  });

  const workerBase = fromMonorepo("worker", ["services/worker/**", "packages/shared/**", "supabase/migrations/**", "scripts/migrate.mjs"]);
  const worker = service(NAME("worker"), {
    ...workerBase,
    start: node("services/worker/dist/main.js"),
    preDeploy: MIGRATE,
    // No HTTP port: extraction and Web Push (digest every 5 minutes, alerts) in one always-on process.
    deploy: { restartPolicyType: "ALWAYS" },
    env: {
      ...workerBase.env,
      LOG_LEVEL: "info",
      DATABASE_URL: preserve(),
      ANTHROPIC_API_KEY: preserve(),
      // Model names live in configuration, never in code (CLAUDE.md).
      EXTRACTION_MODEL: "claude-haiku-4-5",
      // Short first look at a batch (message-triage); remove to keep only the free rules.
      TRIAGE_MODEL: "claude-haiku-4-5",
      // OpenAI instead of Claude (llm-provider): set the key and OPENAI_EXTRACTION_MODEL in Railway;
      // OPENAI_TRIAGE_MODEL and OPENAI_DOCUMENT_MODEL (vision) are optional. Unset = Claude.
      OPENAI_API_KEY: preserve(),
      OPENAI_EXTRACTION_MODEL: preserve(),
      OPENAI_TRIAGE_MODEL: preserve(),
      OPENAI_DOCUMENT_MODEL: preserve(),
      EXTRACTION_DELAY_SECONDS: "15",
      EXTRACTION_CONFIDENCE_THRESHOLD: "0.7",
      EXTRACTION_CONTEXT_MESSAGES: "50",
      // Web Push (formerly the separate cron service). VAPID pair: `npm run vapid:generate -w @czyzyk/worker`
      // (docs/wdrozenie.md). Without them the worker runs extraction only.
      VAPID_PUBLIC_KEY: preserve(),
      VAPID_PRIVATE_KEY: preserve(),
      VAPID_SUBJECT: preserve(),
      DIGEST_WINDOW_MINUTES: "120",
    },
  });

  const pwaBase = fromMonorepo("pwa", [
    "apps/pwa/**",
    "packages/shared/src/extraction.ts",
    "packages/shared/src/chatExport.ts",
    "packages/shared/src/assistant.ts",
    "packages/shared/src/prompts.ts",
    "packages/shared/src/contacts.ts",
  ]);
  const pwa = service(NAME("pwa"), {
    ...pwaBase,
    healthcheck: "/",
    deploy: { restartPolicyType: "ON_FAILURE", restartPolicyMaxRetries: 10 },
    env: {
      ...pwaBase.env,
      // Public values only – they are compiled into the browser bundle.
      VITE_SUPABASE_URL: preserve(),
      VITE_SUPABASE_ANON_KEY: preserve(),
      // The API's public domain (bare; the PWA adds https://), resolved at build time.
      VITE_API_URL: refTo("api", "RAILWAY_PUBLIC_DOMAIN"),
      // Public half of the VAPID pair, needed by the browser to subscribe.
      VITE_VAPID_PUBLIC_KEY: refTo("worker", "VAPID_PUBLIC_KEY"),
    },
  });

  return project("czyzyk", {
    resources: [group("czyzyk", [api, worker, pwa])],
  });
});

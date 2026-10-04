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
 * scripts/migrate.mjs is idempotent and takes an advisory lock, so both services may run it.
 *
 * Secrets are never committed: variables marked preserve() keep the value already
 * stored in Railway (set them once in the dashboard or with `railway variables --set`).
 * Apply is declarative – a variable missing here would be deleted, so every variable
 * a service uses is listed, secret or not.
 */
import { defineRailway, github, group, preserve, project, service } from "railway/iac";

const REPO = "dsoosh/czyzyk";

/** Applies pending supabase/migrations with DATABASE_URL before the new version starts. */
const MIGRATE = "npm run db:migrate";

/** Every service builds from the repository root; CZYZYK_SERVICE picks what to build and start. */
const fromMonorepo = (name: "api" | "worker" | "pwa", watch: string[]) => ({
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

export default defineRailway(() => {
  const apiBase = fromMonorepo("api", ["services/api/**", "packages/shared/**", "supabase/migrations/**", "scripts/migrate.mjs"]);
  const api = service("api", {
    ...apiBase,
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
    },
  });

  const workerBase = fromMonorepo("worker", ["services/worker/**", "packages/shared/**", "supabase/migrations/**", "scripts/migrate.mjs"]);
  const worker = service("worker", {
    ...workerBase,
    preDeploy: MIGRATE,
    // No HTTP port: pg-boss worker that must always run.
    deploy: { restartPolicyType: "ALWAYS" },
    env: {
      ...workerBase.env,
      LOG_LEVEL: "info",
      DATABASE_URL: preserve(),
      ANTHROPIC_API_KEY: preserve(),
      // Model names live in configuration, never in code (CLAUDE.md).
      EXTRACTION_MODEL: "claude-haiku-4-5",
      EXTRACTION_DEBOUNCE_MINUTES: "30",
      EXTRACTION_CONFIDENCE_THRESHOLD: "0.7",
      EXTRACTION_CONTEXT_MESSAGES: "50",
    },
  });

  const pwaBase = fromMonorepo("pwa", ["apps/pwa/**", "packages/shared/src/extraction.ts"]);
  const pwa = service("pwa", {
    ...pwaBase,
    healthcheck: "/",
    deploy: { restartPolicyType: "ON_FAILURE", restartPolicyMaxRetries: 10 },
    env: {
      ...pwaBase.env,
      // Public values only – they are compiled into the browser bundle.
      VITE_SUPABASE_URL: preserve(),
      VITE_SUPABASE_ANON_KEY: preserve(),
      // Railway reference variable: the API's public domain, resolved at build time.
      VITE_API_URL: "https://${{api.RAILWAY_PUBLIC_DOMAIN}}",
    },
  });

  return project("czyzyk", {
    resources: [group("czyzyk", [api, worker, pwa])],
  });
});

#!/usr/bin/env node
// Builds or starts one deployable service of the monorepo, chosen by CZYZYK_SERVICE
// (api | worker | pwa). Lets Railway's default Node build (`npm run build`, `npm start`
// at the repository root) deploy each service without per-service config files.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SERVICES = {
  api: { workspace: "@czyzyk/api", needsShared: true },
  worker: { workspace: "@czyzyk/worker", needsShared: true },
  pwa: { workspace: "@czyzyk/pwa", needsShared: false, afterBuild: ["check:secrets"] },
};

/**
 * Which service to build or start: CZYZYK_SERVICE if set, otherwise derived from the
 * Railway service name (RAILWAY_SERVICE_NAME, set by Railway at build and run time),
 * e.g. "pwa", "czyzyk-pwa" or "Czyżyk API". Returns null when it cannot tell.
 */
export function resolveService(env) {
  const explicit = env.CZYZYK_SERVICE?.trim().toLowerCase();
  if (explicit) return { name: explicit, source: "CZYZYK_SERVICE" };
  const railwayName = env.RAILWAY_SERVICE_NAME;
  if (!railwayName) return null;
  const tokens = railwayName.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const matches = Object.keys(SERVICES).filter((name) => tokens.includes(name));
  return matches.length === 1 ? { name: matches[0], source: `RAILWAY_SERVICE_NAME "${railwayName}"` } : null;
}

function help(env) {
  const seen = env.RAILWAY_SERVICE_NAME ? ` (Railway service "${env.RAILWAY_SERVICE_NAME}")` : "";
  return (
    `Cannot tell which service to run${seen}. Set the variable CZYZYK_SERVICE to one of: ` +
    `${Object.keys(SERVICES).join(", ")} – or name the Railway service accordingly, ` +
    "or apply .railway/railway.ts with `railway config apply`."
  );
}

const command = process.argv[2];
const isMain = process.argv[1] === fileURLToPath(import.meta.url);


function npm(...args) {
  const result = spawnSync("npm", args, { stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (isMain) {
  if (!["build", "start"].includes(command)) {
    console.error("usage: node scripts/service.mjs <build|start>");
    process.exit(2);
  }

  const resolved = resolveService(process.env);
  if (!resolved) {
    if (command === "build" && !process.env.RAILWAY_SERVICE_NAME) {
      // Local / CI: build everything.
      npm("run", "build", "-w", "@czyzyk/shared");
      npm("run", "build", "-w", "@czyzyk/api", "-w", "@czyzyk/worker", "-w", "@czyzyk/pwa");
      process.exit(0);
    }
    console.error(help(process.env));
    process.exit(2);
  }
  const name = resolved.name;

  const service = SERVICES[name];
  if (!service) {
    console.error(`Unknown service "${name}" (from ${resolved.source}). Use one of: ${Object.keys(SERVICES).join(", ")}`);
    process.exit(2);
  }
  console.log(`czyzyk: ${command} ${name} (from ${resolved.source})`);

  if (command === "build") {
    if (service.needsShared) npm("run", "build", "-w", "@czyzyk/shared");
    npm("run", "build", "-w", service.workspace);
    for (const script of service.afterBuild ?? []) npm("run", script, "-w", service.workspace);
  } else {
    npm("run", "start", "-w", service.workspace);
  }
}

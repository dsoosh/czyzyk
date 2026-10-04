#!/usr/bin/env node
// Builds or starts one deployable service of the monorepo, chosen by CZYZYK_SERVICE
// (api | worker | pwa). Lets Railway's default Node build (`npm run build`, `npm start`
// at the repository root) deploy each service without per-service config files.
import { spawnSync } from "node:child_process";

const SERVICES = {
  api: { workspace: "@czyzyk/api", needsShared: true },
  worker: { workspace: "@czyzyk/worker", needsShared: true },
  pwa: { workspace: "@czyzyk/pwa", needsShared: false, afterBuild: ["check:secrets"] },
};

const command = process.argv[2];
const name = process.env.CZYZYK_SERVICE;

function npm(...args) {
  const result = spawnSync("npm", args, { stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!["build", "start"].includes(command)) {
  console.error("usage: node scripts/service.mjs <build|start>");
  process.exit(2);
}

if (!name) {
  if (command === "build") {
    // Local / CI: build everything.
    npm("run", "build", "-w", "@czyzyk/shared");
    npm("run", "build", "-w", "@czyzyk/api", "-w", "@czyzyk/worker", "-w", "@czyzyk/pwa");
    process.exit(0);
  }
  console.error("Set CZYZYK_SERVICE to one of: " + Object.keys(SERVICES).join(", "));
  process.exit(2);
}

const service = SERVICES[name];
if (!service) {
  console.error(`Unknown CZYZYK_SERVICE "${name}". Use one of: ${Object.keys(SERVICES).join(", ")}`);
  process.exit(2);
}

if (command === "build") {
  if (service.needsShared) npm("run", "build", "-w", "@czyzyk/shared");
  npm("run", "build", "-w", service.workspace);
  for (const script of service.afterBuild ?? []) npm("run", script, "-w", service.workspace);
} else {
  npm("run", "start", "-w", service.workspace);
}

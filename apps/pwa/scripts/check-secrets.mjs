#!/usr/bin/env node
// Fails when the built PWA contains anything that must stay on the server:
// service-role keys, AI provider keys or the names of their variables.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const FORBIDDEN = [
  /SUPABASE_SERVICE_ROLE_KEY/,
  /service_role/,
  /ANTHROPIC/i,
  /VOYAGE/i,
  /sk-ant-[A-Za-z0-9_-]{10,}/,
  /pa-[A-Za-z0-9_-]{30,}/, // Voyage API keys
];

/** True for a JWT whose payload claims a role other than anon. */
function isPrivilegedJwt(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    return typeof payload.role === "string" && payload.role !== "anon";
  } catch {
    return false;
  }
}

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else yield path;
  }
}

export function findSecrets(dir) {
  const findings = [];
  for (const path of files(dir)) {
    if (!/\.(js|mjs|html|json|webmanifest|css|map|txt)$/.test(path)) continue;
    const text = readFileSync(path, "utf8");
    for (const pattern of FORBIDDEN) {
      if (pattern.test(text)) findings.push(`${path}: ${pattern}`);
    }
    for (const jwt of text.match(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) ?? []) {
      if (isPrivilegedJwt(jwt)) findings.push(`${path}: privileged JWT`);
    }
  }
  return findings;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2] ?? fileURLToPath(new URL("../dist", import.meta.url));
  const findings = findSecrets(dir);
  if (findings.length > 0) {
    console.error("Server-only secrets found in the PWA build:\n" + findings.map((f) => `  ${f}`).join("\n"));
    process.exit(1);
  }
  console.log(`No server-only secrets in ${dir}`);
}

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error -- plain ESM script without type declarations
import { findSecrets } from "./check-secrets.mjs";

const jwt = (payload: object) =>
  `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.sig`;

function dirWith(content: string) {
  const dir = mkdtempSync(join(tmpdir(), "pwa-secrets-"));
  writeFileSync(join(dir, "app.js"), content);
  return dir;
}

describe("check-secrets", () => {
  it("accepts the anon key", () => {
    expect(findSecrets(dirWith(`const k = "${jwt({ role: "anon" })}";`))).toEqual([]);
  });

  it("rejects a service role JWT", () => {
    expect(findSecrets(dirWith(`const k = "${jwt({ role: "x" })}";`))).toHaveLength(1);
  });

  it("rejects provider key names and values", () => {
    expect(findSecrets(dirWith("process.env.ANTHROPIC_API_KEY"))).not.toEqual([]);
    expect(findSecrets(dirWith('"sk-ant-api03-abcdefghijklmnop"'))).not.toEqual([]);
  });
});

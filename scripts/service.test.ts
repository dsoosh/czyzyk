import { describe, expect, it } from "vitest";
// @ts-expect-error -- plain ESM script without type declarations
import { resolveService } from "./service.mjs";

describe("resolveService", () => {
  it("prefers CZYZYK_SERVICE", () => {
    expect(resolveService({ CZYZYK_SERVICE: "PWA ", RAILWAY_SERVICE_NAME: "api" })).toEqual({ name: "pwa", source: "CZYZYK_SERVICE" });
  });

  it("derives the service from the Railway service name", () => {
    for (const [railway, name] of [["pwa", "pwa"], ["czyzyk-pwa", "pwa"], ["Czyżyk API", "api"], ["worker_prod", "worker"], ["czyzyk-cron", "cron"]]) {
      expect(resolveService({ RAILWAY_SERVICE_NAME: railway })?.name).toBe(name);
    }
  });

  it("gives up on unknown or ambiguous names", () => {
    expect(resolveService({ RAILWAY_SERVICE_NAME: "czyzyk" })).toBeNull();
    expect(resolveService({ RAILWAY_SERVICE_NAME: "api-worker" })).toBeNull();
    expect(resolveService({})).toBeNull();
  });
});

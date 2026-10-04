import { describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { loadApiConfig } from "./config.js";

describe("GET /health", () => {
  it("returns ok", async () => {
    const app = buildApp({ NODE_ENV: "test", LOG_LEVEL: "info" });
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
    await app.close();
  });
});

describe("loadApiConfig", () => {
  it("uses defaults from .env.example values", () => {
    expect(loadApiConfig({})).toMatchObject({ PORT: 3000, HOST: "0.0.0.0", LOG_LEVEL: "info" });
  });
});

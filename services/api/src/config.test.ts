import { describe, expect, it } from "vitest";
import { loadApiConfig } from "./config.js";

describe("loadApiConfig", () => {
  it("applies defaults and requires DATABASE_URL", () => {
    expect(loadApiConfig({ DATABASE_URL: "postgres://user:pass@localhost/db" })).toMatchObject({
      PORT: 3000,
      HOST: "0.0.0.0",
      INGEST_RATE_LIMIT_PER_TOKEN: 120,
    });
    expect(() => loadApiConfig({})).toThrow(/DATABASE_URL: missing/);
  });
});

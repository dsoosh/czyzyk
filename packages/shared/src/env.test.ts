import { describe, expect, it } from "vitest";
import { z } from "zod";
import { EnvError, loadEnv } from "./env.js";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().default(3000),
});

describe("loadEnv", () => {
  it("parses valid values and applies defaults", () => {
    expect(loadEnv(schema, { DATABASE_URL: "postgres://localhost/db" })).toEqual({
      DATABASE_URL: "postgres://localhost/db",
      PORT: 3000,
    });
  });

  it("names a missing variable in a readable message", () => {
    expect(() => loadEnv(schema, {})).toThrowError(/DATABASE_URL: missing/);
  });

  it("reports invalid values without echoing them", () => {
    try {
      loadEnv(schema, { DATABASE_URL: "secret-not-a-url" });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(EnvError);
      expect((error as EnvError).message).toContain("DATABASE_URL");
      expect((error as EnvError).message).not.toContain("secret-not-a-url");
    }
  });
});

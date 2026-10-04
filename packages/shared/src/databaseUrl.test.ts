import { describe, expect, it } from "vitest";
import { describeDatabaseUrlProblem } from "./databaseUrl.js";
import { loadEnv } from "./env.js";
import { z } from "zod";
import { databaseUrlSchema } from "./databaseUrl.js";

describe("DATABASE_URL validation", () => {
  it("accepts a Supabase session pooler URL", () => {
    expect(describeDatabaseUrlProblem("postgresql://postgres.abcdefghijklmnopqrst:s3cret@aws-0-eu-central-1.pooler.supabase.com:5432/postgres")).toBeNull();
  });

  it("detects a password glued to the user name", () => {
    expect(describeDatabaseUrlProblem("postgresql://postgres.abcdefghijklmnopqrstSECRET@aws-0.pooler.supabase.com:5432/postgres")).toMatch(/no password/);
  });

  it("never echoes the value in the error", () => {
    const schema = z.object({ DATABASE_URL: databaseUrlSchema });
    expect(() => loadEnv(schema, { DATABASE_URL: "postgresql://postgres.refSECRETVALUE@host:5432/postgres" })).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining("SECRETVALUE") }),
    );
  });

  it("rejects non-postgres and malformed URLs", () => {
    expect(describeDatabaseUrlProblem("mysql://u:p@h/db")).toMatch(/postgresql/);
    expect(describeDatabaseUrlProblem("nonsense")).toMatch(/not a valid URL/);
  });
});

import { z } from "zod";

export class EnvError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Invalid environment configuration:\n${issues.map((i) => `  - ${i}`).join("\n")}`);
    this.name = "EnvError";
  }
}

/**
 * Parses environment variables with a zod object schema. Throws an EnvError that
 * names every missing or invalid variable, never their values (they may be secrets).
 */
export function loadEnv<T extends z.ZodObject>(
  schema: T,
  source: Record<string, string | undefined> = process.env,
): z.infer<T> {
  const result = schema.safeParse(source);
  if (result.success) return result.data;
  const issues = result.error.issues.map((issue) => {
    const name = issue.path.join(".") || "(root)";
    return source[name] === undefined ? `${name}: missing` : `${name}: ${issue.message}`;
  });
  throw new EnvError(issues);
}

/** Common optional values with sane defaults, reused by every service. */
export const baseEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

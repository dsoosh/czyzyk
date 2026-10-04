import { z } from "zod";

/**
 * Postgres connection string with a password (e.g. Supabase session pooler).
 * Problems are reported without echoing the value, which contains a secret.
 */
export function describeDatabaseUrlProblem(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "is not a valid URL (expected postgresql://user:password@host:5432/postgres)";
  }
  if (!/^postgres(ql)?:$/.test(url.protocol)) return "must start with postgresql://";
  if (!url.username) return "has no user name";
  if (!url.password) {
    return "has no password – expected postgresql://user:password@host:5432/postgres (is the ':' between user and password missing?)";
  }
  if (!url.hostname) return "has no host";
  return null;
}

export const databaseUrlSchema = z.string().superRefine((value, ctx) => {
  const problem = describeDatabaseUrlProblem(value);
  if (problem) ctx.addIssue({ code: "custom", message: problem });
});

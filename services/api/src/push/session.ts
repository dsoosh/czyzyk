import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

/** Resolves a Supabase access token to the user id, or throws when it is not valid. */
export type SessionVerifier = (accessToken: string) => Promise<string>;

/**
 * Verifies Supabase session JWTs: signature (project JWKS, or the legacy HS256
 * secret), issuer `<SUPABASE_URL>/auth/v1`, audience `authenticated` and expiry.
 */
export function createSessionVerifier(options: {
  supabaseUrl: string;
  jwtSecret?: string;
  /** Overrides the project JWKS (tests use a local key set). */
  keys?: JWTVerifyGetKey;
}): SessionVerifier {
  const issuer = `${options.supabaseUrl.replace(/\/+$/, "")}/auth/v1`;
  const secret = options.jwtSecret ? new TextEncoder().encode(options.jwtSecret) : null;
  const keys = options.keys ?? createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));

  return async (accessToken) => {
    const verifyOptions = { issuer, audience: "authenticated" };
    const { payload } = secret
      ? await jwtVerify(accessToken, secret, { ...verifyOptions, algorithms: ["HS256"] })
      : await jwtVerify(accessToken, keys, { ...verifyOptions, algorithms: ["ES256", "RS256"] });
    if (typeof payload.sub !== "string" || payload.sub === "") throw new Error("token without subject");
    return payload.sub;
  };
}

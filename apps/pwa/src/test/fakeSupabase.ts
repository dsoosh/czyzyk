import { vi } from "vitest";
import type { Db } from "../lib/supabase";
import type { AllowedEmail, Profile } from "../lib/types";

type AuthCallback = (event: string, session: unknown) => void;

export interface FakeOptions {
  /** Signed-in user id, or null when there is no session. */
  userId?: string | null;
  profile?: Profile | null;
  allowedEmails?: AllowedEmail[];
  rpcError?: string;
}

/** Minimal stand-in for the supabase-js surface the PWA uses. */
export function fakeSupabase(options: FakeOptions = {}) {
  const listeners: AuthCallback[] = [];
  let session = options.userId ? { user: { id: options.userId } } : null;
  const allowed = [...(options.allowedEmails ?? [])];

  const auth = {
    onAuthStateChange: vi.fn((cb: AuthCallback) => {
      listeners.push(cb);
      queueMicrotask(() => cb("INITIAL_SESSION", session));
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }),
    getSession: vi.fn(async () => ({ data: { session }, error: null })),
    signInWithOAuth: vi.fn(async () => ({ data: {}, error: null })),
    signOut: vi.fn(async () => {
      session = null;
      listeners.forEach((cb) => cb("SIGNED_OUT", null));
      return { error: null };
    }),
  };

  const from = vi.fn((table: string) => {
    const result = () => {
      if (table === "profiles") return { data: options.profile ?? null, error: null };
      if (table === "allowed_emails") return { data: allowed, error: null };
      return { data: [], error: null };
    };
    const builder = {
      select: () => builder,
      eq: () => builder,
      order: () => builder,
      returns: () => builder,
      maybeSingle: async () => result(),
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(result()).then(resolve),
    };
    return builder;
  });

  const rpc = vi.fn(async (name: string, args: Record<string, string>) => {
    if (options.rpcError) return { data: null, error: { message: options.rpcError } };
    if (name === "admin_upsert_allowed_email") {
      const existing = allowed.find((r) => r.email === args.p_email);
      if (existing) existing.role = args.p_role as AllowedEmail["role"];
      else allowed.push({ email: args.p_email!, role: args.p_role as AllowedEmail["role"], created_at: "" });
    }
    return { data: null, error: null };
  });

  return { client: { auth, from, rpc } as unknown as Db, auth, from, rpc };
}

export const adminProfile: Profile = { id: "u-admin", email: "darek@example.com", display_name: "Darek", role: "admin" };
export const familyProfile: Profile = { id: "u-ola", email: "ola@example.com", display_name: "Ola", role: "family" };

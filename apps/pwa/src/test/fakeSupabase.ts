import { vi } from "vitest";
import type { Db } from "../lib/supabase";
import type { AllowedEmail, Profile } from "../lib/types";

type AuthCallback = (event: string, session: unknown) => void;
type Row = Record<string, unknown>;
type RpcHandler = (args: Record<string, unknown>, tables: Record<string, Row[]>) => unknown;

export interface FakeOptions {
  /** Signed-in user id, or null when there is no session. */
  userId?: string | null;
  profile?: Profile | null;
  allowedEmails?: AllowedEmail[];
  /** Table contents; queries filter them like PostgREST would. */
  tables?: Record<string, Row[]>;
  rpc?: Record<string, RpcHandler>;
  rpcError?: string;
}

const MARKS: Record<string, { table: string; by: string; at: string }> = {
  mark_packed: { table: "bring_items", by: "packed_by", at: "packed_at" },
  mark_paid: { table: "payments", by: "paid_by", at: "paid_at" },
  mark_resolved: { table: "action_required", by: "resolved_by", at: "resolved_at" },
};

function compare(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

/** Minimal stand-in for the supabase-js surface the PWA uses, with real filtering. */
export function fakeSupabase(options: FakeOptions = {}) {
  const listeners: AuthCallback[] = [];
  let session = options.userId ? { user: { id: options.userId } } : null;
  const tables: Record<string, Row[]> = { ...(options.tables ?? {}) };
  if (options.profile) tables.profiles = [options.profile as unknown as Row, ...(tables.profiles ?? [])];
  tables.allowed_emails = [...((options.allowedEmails ?? []) as unknown as Row[]), ...(tables.allowed_emails ?? [])];

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
    const filters: ((r: Row) => boolean)[] = [];
    const orders: { col: string; asc: boolean }[] = [];
    let limit = Infinity;
    const rows = () => {
      let out = (tables[table] ?? []).filter((r) => filters.every((f) => f(r)));
      for (const o of [...orders].reverse()) {
        out = [...out].sort((a, b) => {
          if (a[o.col] == null) return 1;
          if (b[o.col] == null) return -1;
          return (o.asc ? 1 : -1) * compare(a[o.col], b[o.col]);
        });
      }
      return out.slice(0, limit);
    };
    const builder = {
      select: () => builder,
      returns: () => builder,
      eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), builder),
      neq: (c: string, v: unknown) => (filters.push((r) => r[c] !== v), builder),
      in: (c: string, v: unknown[]) => (filters.push((r) => v.includes(r[c])), builder),
      gt: (c: string, v: unknown) => (filters.push((r) => r[c] != null && compare(r[c], v) > 0), builder),
      gte: (c: string, v: unknown) => (filters.push((r) => r[c] != null && compare(r[c], v) >= 0), builder),
      lt: (c: string, v: unknown) => (filters.push((r) => r[c] != null && compare(r[c], v) < 0), builder),
      lte: (c: string, v: unknown) => (filters.push((r) => r[c] != null && compare(r[c], v) <= 0), builder),
      is: (c: string, v: null) => (filters.push((r) => (r[c] ?? null) === v), builder),
      not: (c: string, op: string, v: unknown) => {
        if (op !== "is" || v !== null) throw new Error(`fake: unsupported not(${op})`);
        filters.push((r) => r[c] != null);
        return builder;
      },
      order: (col: string, o?: { ascending?: boolean }) => (orders.push({ col, asc: o?.ascending ?? true }), builder),
      limit: (n: number) => ((limit = n), builder),
      maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
      single: async () => {
        const r = rows()[0];
        return r ? { data: r, error: null } : { data: null, error: { message: "not found" } };
      },
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve({ data: rows(), error: null }).then(resolve, reject),
    };
    return builder;
  });

  const rpc = vi.fn(async (name: string, args: Record<string, unknown> = {}) => {
    if (options.rpcError) return { data: null, error: { message: options.rpcError } };
    const handler = options.rpc?.[name];
    if (handler) return { data: handler(args, tables), error: null };
    const mark = MARKS[name];
    if (mark) {
      const row = (tables[mark.table] ?? []).find((r) => r.id === args.p_id);
      if (!row) return { data: null, error: { message: "not found" } };
      row[mark.by] = args.p_done ? options.userId : null;
      row[mark.at] = args.p_done ? new Date().toISOString() : null;
      return { data: row, error: null };
    }
    if (name === "admin_upsert_allowed_email") {
      const list = tables.allowed_emails!;
      const existing = list.find((r) => r.email === args.p_email);
      if (existing) existing.role = args.p_role;
      else list.push({ email: args.p_email, role: args.p_role, created_at: "" });
    }
    return { data: null, error: null };
  });

  return { client: { auth, from, rpc } as unknown as Db, auth, from, rpc, tables };
}

export const adminProfile: Profile = { id: "u-admin", email: "darek@example.com", display_name: "Darek", role: "admin" };
export const familyProfile: Profile = { id: "u-ola", email: "ola@example.com", display_name: "Ola", role: "family" };

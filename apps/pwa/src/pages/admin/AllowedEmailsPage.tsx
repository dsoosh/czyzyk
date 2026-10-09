import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth, useProfile } from "../../auth/AuthProvider";
import type { AllowedEmail, Role } from "../../lib/types";

const ROLE_LABELS: Record<Role, string> = { admin: "Administrator", family: "Rodzina" };

export function AllowedEmailsPage() {
  const { client } = useAuth();
  const me = useProfile();
  const [rows, setRows] = useState<AllowedEmail[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("family");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error: e } = await client
      .from("allowed_emails")
      .select("email, role, created_at")
      .order("email")
      .returns<AllowedEmail[]>();
    if (e) setError("Nie udało się wczytać listy.");
    else setRows(data ?? []);
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (fn: () => PromiseLike<{ error: { message: string } | null }>) => {
    setBusy(true);
    setError(null);
    const { error: e } = await fn();
    setBusy(false);
    if (e) {
      setError(e.message);
      return false;
    }
    await load();
    return true;
  };

  const onAdd = async (event: FormEvent) => {
    event.preventDefault();
    const ok = await run(() => client.rpc("admin_upsert_allowed_email", { p_email: email, p_role: role }));
    if (ok) {
      setEmail("");
      setRole("family");
    }
  };

  return (
    <section className="space-y-4">
      <h1 className="font-display text-4xl font-bold text-ink">Dostęp</h1>
      <AccessRequests onDecided={() => void load()} />
      <h2 className="font-display text-2xl font-bold text-ink">Adresy z dostępem</h2>
      <p className="text-sm text-slate-600">
        Te adresy mają dostęp do aplikacji. Adres dodany tutaj trafia do Twojej rodziny; rodziny dodają swoich członków same w ustawieniach.
      </p>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <form onSubmit={(e) => void onAdd(e)} className="space-y-2 rounded-2xl bg-white p-4 shadow-sm">
        <label className="block text-sm font-medium" htmlFor="new-email">
          Adres e-mail
        </label>
        <input
          id="new-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="babcia@example.com"
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
        />
        <div className="flex gap-2">
          <select
            aria-label="Rola nowego adresu"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2"
          >
            <option value="family">{ROLE_LABELS.family}</option>
            <option value="admin">{ROLE_LABELS.admin}</option>
          </select>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-brand-700 px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            Dodaj
          </button>
        </div>
      </form>

      {rows === null ? (
        <p className="text-slate-500">Wczytywanie…</p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-2xl bg-white shadow-sm">
          {rows.map((row) => {
            const isMe = row.email === me.email;
            return (
              <li key={row.email} className="flex flex-wrap items-center gap-2 p-4">
                <span className="min-w-0 flex-1 truncate">
                  {row.email}
                  {isMe && <span className="ml-2 text-xs text-slate-500">(Ty)</span>}
                </span>
                <select
                  aria-label={`Rola ${row.email}`}
                  value={row.role}
                  disabled={busy || isMe}
                  onChange={(e) =>
                    void run(() => client.rpc("admin_upsert_allowed_email", { p_email: row.email, p_role: e.target.value }))
                  }
                  className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                >
                  <option value="family">{ROLE_LABELS.family}</option>
                  <option value="admin">{ROLE_LABELS.admin}</option>
                </select>
                <button
                  type="button"
                  disabled={busy || isMe}
                  aria-label={`Usuń ${row.email}`}
                  onClick={() => {
                    if (window.confirm(`Usunąć ${row.email} z listy dostępu? Ta osoba straci dostęp.`)) {
                      void run(() => client.rpc("admin_delete_allowed_email", { p_email: row.email }));
                    }
                  }}
                  className="rounded-lg px-2 py-1 text-sm text-red-700 hover:bg-red-50 disabled:opacity-40"
                >
                  Usuń
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

interface AccessRequest {
  email: string;
  display_name: string | null;
  requested_at: string;
}

/** Pending access requests: approving creates a new family (families-joining). */
function AccessRequests({ onDecided }: { onDecided: () => void }) {
  const { client } = useAuth();
  const [rows, setRows] = useState<AccessRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error: e } = await client
      .from("access_requests")
      .select("email, display_name, requested_at")
      .eq("status", "pending")
      .order("requested_at")
      .returns<AccessRequest[]>();
    if (e) setError("Nie udało się wczytać próśb o dostęp.");
    else setRows(data ?? []);
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (fn: "admin_approve_access_request" | "admin_reject_access_request", email: string) => {
    setBusy(true);
    setError(null);
    const { error: e } = await client.rpc(fn, { p_email: email });
    setBusy(false);
    if (e) setError(e.message);
    await load();
    onDecided();
  };

  if (rows === null && !error) return null;
  return (
    <section aria-label="Prośby o dostęp" className="space-y-2">
      <h2 className="font-display text-2xl font-bold text-ink">Prośby o dostęp</h2>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
      {rows && rows.length === 0 ? (
        <p className="text-sm text-slate-500">Nikt nie czeka na dostęp.</p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-2xl bg-white shadow-sm">
          {rows?.map((r) => (
            <li key={r.email} className="flex flex-wrap items-center gap-2 p-4">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{r.display_name ?? r.email}</span>
                {r.display_name && <span className="block truncate text-sm text-slate-500">{r.email}</span>}
              </span>
              <button
                type="button"
                disabled={busy}
                aria-label={`Akceptuj ${r.email}`}
                onClick={() => void decide("admin_approve_access_request", r.email)}
                className="rounded-lg bg-brand-700 px-3 py-1 text-sm font-semibold text-white disabled:opacity-50"
              >
                Akceptuj
              </button>
              <button
                type="button"
                disabled={busy}
                aria-label={`Odrzuć ${r.email}`}
                onClick={() => {
                  if (window.confirm(`Odrzucić prośbę ${r.email}?`)) void decide("admin_reject_access_request", r.email);
                }}
                className="rounded-lg px-3 py-1 text-sm text-red-700 hover:bg-red-50 disabled:opacity-40"
              >
                Odrzuć
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-slate-500">Akceptacja tworzy nową rodzinę. Drugiego rodzica dodaje sama rodzina w ustawieniach.</p>
    </section>
  );
}

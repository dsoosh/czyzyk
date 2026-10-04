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
      <h1 className="text-2xl font-bold text-brand-900">Lista rodziny</h1>
      <p className="text-sm text-slate-600">Tylko te adresy mogą zalogować się do aplikacji przez Google.</p>

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
                    if (window.confirm(`Usunąć ${row.email} z listy rodziny? Ta osoba straci dostęp.`)) {
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

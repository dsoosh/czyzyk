import { useState, type FormEvent } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { LoadError, Loading } from "../../components/ui";
import { run } from "../../lib/items";
import { useLoader } from "../../lib/useLoader";

interface Member {
  email: string;
  display_name: string | null;
  role: "admin" | "family";
  signed_in: boolean;
  is_me: boolean;
}

/** Members of the family: a family adds the second parent itself, without the operator (families-joining). */
export function FamilySection() {
  const { client } = useAuth();
  const { data, error, reload } = useLoader(async () => (await run<Member[] | null>(client.rpc("family_members"))) ?? [], [client]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const act = async (fn: "family_add_member" | "family_remove_member", value: string) => {
    setBusy(true);
    setMessage(null);
    const { error: e } = await client.rpc(fn, { p_email: value });
    setBusy(false);
    if (e) {
      setMessage(e.message);
      return false;
    }
    reload();
    return true;
  };

  const onAdd = async (event: FormEvent) => {
    event.preventDefault();
    if (await act("family_add_member", email)) setEmail("");
  };

  return (
    <section aria-label="Moja rodzina" className="space-y-3 rounded-[28px] bg-card p-5 shadow-sm">
      <h2 className="font-display text-3xl font-bold text-ink">Moja rodzina</h2>
      <p className="text-sm text-muted">
        Dodaj adres Google drugiego rodzica albo opiekuna. Po zalogowaniu zobaczy dzieci, sprawy i znaczniki Waszej rodziny.
      </p>
      {error ? (
        <LoadError message={error} onRetry={reload} />
      ) : !data ? (
        <Loading />
      ) : (
        <ul className="divide-y divide-slate-200">
          {data.map((m) => (
            <li key={m.email} className="flex items-center gap-2 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate">
                  {m.display_name ?? m.email}
                  {m.is_me && <span className="ml-2 text-xs text-muted">(Ty)</span>}
                </span>
                <span className="block truncate text-sm text-muted">
                  {m.display_name ? `${m.email} · ` : ""}
                  {m.signed_in ? "ma dostęp" : "jeszcze się nie zalogował(a)"}
                </span>
              </span>
              {!m.is_me && m.role !== "admin" && (
                <button
                  type="button"
                  disabled={busy}
                  aria-label={`Usuń ${m.email}`}
                  onClick={() => {
                    if (window.confirm(`Usunąć ${m.email} z rodziny? Ta osoba straci dostęp.`)) void act("family_remove_member", m.email);
                  }}
                  className="rounded-lg px-2 py-1 text-sm text-red-700 hover:bg-red-50 disabled:opacity-40"
                >
                  Usuń
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={(e) => void onAdd(e)} className="flex gap-2">
        <input
          type="email"
          required
          aria-label="Adres e-mail członka rodziny"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tata@gmail.com"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2"
        />
        <button type="submit" disabled={busy} className="rounded-full bg-ink px-4 py-2 font-semibold text-cream disabled:opacity-50">
          Dodaj
        </button>
      </form>
      {message && (
        <p role="alert" className="text-sm text-red-700">
          {message}
        </p>
      )}
    </section>
  );
}

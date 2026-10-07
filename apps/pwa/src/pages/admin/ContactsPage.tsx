import { CONTACT_ROLE_LABELS, CONTACT_ROLES, type ContactRole } from "@czyzyk/shared/contacts";
import { useState, type FormEvent } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { LoadError, Loading } from "../../components/ui";
import { fetchAuthors, fetchContactRoles, saveContactRole, type StoredContactRole } from "../../lib/contacts";
import { shortDate, warsawDay } from "../../lib/dates";
import { useLoader } from "../../lib/useLoader";

interface Row {
  key: string;
  name: string;
  messages: number;
  lastAt: string | null;
  saved: StoredContactRole | null;
}

/** Who writes in the groups: teachers, the management, other parents, our family (contact-roles). */
export function ContactsPage() {
  const { client } = useAuth();
  const { data, error, reload } = useLoader(async () => {
    const [authors, roles] = await Promise.all([fetchAuthors(client), fetchContactRoles(client)]);
    const rows: Row[] = authors.map((a) => ({ ...a, saved: roles.find((r) => r.author_key === a.key) ?? null }));
    // Mapped numbers that have not written yet (e.g. a family member's own number).
    for (const r of roles) {
      if (!rows.some((row) => row.key === r.author_key)) rows.push({ key: r.author_key, name: r.author_key, messages: 0, lastAt: null, saved: r });
    }
    return rows;
  }, [client]);

  if (error) return <LoadError message={error} onRetry={reload} />;
  if (!data) return <Loading />;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="font-display text-4xl font-bold text-ink">Kontakty</h1>
        <p className="text-sm text-muted">
          Autorzy wiadomości ze śledzonych grup. Nadaj rolę – „ciocia”, „dyrekcja”, „rodzic” albo „nasza rodzina” – a wiadomości będą tak oznaczone w
          historii grup, w analizie i dla asystenta. Swój numer każdy członek rodziny może też wskazać sam w Ustawieniach.
        </p>
      </div>
      {data.length === 0 ? (
        <p className="text-muted">Brak wiadomości w śledzonych grupach.</p>
      ) : (
        <ul className="space-y-2">
          {data.map((row) => (
            <li key={`${row.key}:${row.saved?.role ?? ""}:${row.saved?.label ?? ""}`}>
              <ContactForm row={row} onSaved={reload} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ContactForm({ row, onSaved }: { row: Row; onSaved: () => void }) {
  const { client } = useAuth();
  const [role, setRole] = useState<ContactRole | "">(row.saved?.role ?? "");
  const [label, setLabel] = useState(row.saved?.label ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changed = role !== (row.saved?.role ?? "") || label.trim() !== (row.saved?.label ?? "");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await saveContactRole(client, row.key, role || null, label);
      onSaved();
    } catch {
      setError("Nie udało się zapisać.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} aria-label={row.name} className="space-y-2 rounded-3xl bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-semibold text-ink">{row.name}</span>
        <span className="text-xs text-muted">
          {row.messages > 0 && row.lastAt ? `${row.messages} wiad., ostatnio ${shortDate(warsawDay(row.lastAt))}` : "jeszcze nie pisał(a)"}
          {row.saved?.profile_id && " · numer członka rodziny"}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as ContactRole | "")}
          aria-label="Rola"
          className="rounded-full border border-sand-400 bg-white px-3 py-1.5 text-sm"
        >
          <option value="">— bez roli —</option>
          {CONTACT_ROLES.map((r) => (
            <option key={r} value={r}>
              {CONTACT_ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={60}
          placeholder="Opis, np. Ciocia Ania (Sokoły)"
          aria-label="Opis"
          disabled={!role}
          className="min-w-0 flex-1 rounded-full border border-sand-400 px-3 py-1.5 text-sm disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={busy || !changed}
          className="rounded-full bg-brand-700 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-45"
        >
          Zapisz
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}

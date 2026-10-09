import { useState, type FormEvent } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { LoadError, Loading } from "../../components/ui";
import type { Group } from "../../lib/items";
import { useLoader } from "../../lib/useLoader";

function GroupRow({
  group,
  onSave,
}: {
  group: Group;
  onSave: (tracked: boolean, displayName: string, shared: boolean) => Promise<void>;
}) {
  const [displayName, setDisplayName] = useState(group.display_name ?? "");
  const dirty = displayName !== (group.display_name ?? "");
  return (
    <li className="space-y-2 p-4">
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1 truncate font-medium" title={group.wa_name}>
          {group.wa_name}
        </span>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={group.tracked}
            onChange={(e) => void onSave(e.target.checked, displayName, group.shared ?? false)}
            className="h-5 w-5 accent-brand-700"
          />
          Śledź
        </label>
        <label className="flex items-center gap-2 text-sm" title="Widoczna dla wszystkich rodzin, niezależnie od dzieci">
          <input
            type="checkbox"
            checked={group.shared ?? false}
            onChange={(e) => void onSave(group.tracked, displayName, e.target.checked)}
            className="h-5 w-5 accent-brand-700"
          />
          Wspólna
        </label>
      </div>
      <div className="flex gap-2">
        <input
          aria-label={`Nazwa wyświetlana ${group.wa_name}`}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Nazwa wyświetlana, np. Motylki"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        />
        <button
          type="button"
          disabled={!dirty}
          onClick={() => void onSave(group.tracked, displayName, group.shared ?? false)}
          className="rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          Zapisz
        </button>
      </div>
    </li>
  );
}

/** A group added by name before its first notification (manual-entry). */
function AddGroupForm({ onAdd }: { onAdd: (name: string, displayName: string) => Promise<boolean> }) {
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    if (await onAdd(name, displayName)) {
      setName("");
      setDisplayName("");
    }
    setBusy(false);
  };
  return (
    <form onSubmit={submit} aria-label="Dodaj grupę" className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="font-semibold">Dodaj grupę</h2>
      <p className="text-sm text-slate-600">
        Nazwa dokładnie taka jak w WhatsAppie (wielkość liter, emoji). Grupa od razu będzie śledzona; telefon zacznie ją zapisywać po
        odświeżeniu listy grup.
      </p>
      <input
        aria-label="Nazwa grupy w WhatsAppie"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={200}
        required
        placeholder="Nazwa grupy w WhatsAppie"
        className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
      />
      <input
        aria-label="Nazwa wyświetlana nowej grupy"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        placeholder="Nazwa wyświetlana (opcjonalnie), np. Motylki"
        className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
      />
      <button
        type="submit"
        disabled={busy || !name.trim()}
        className="rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
      >
        Dodaj i śledź
      </button>
    </form>
  );
}

export function GroupsPage() {
  const { client } = useAuth();
  const [actionError, setActionError] = useState<string | null>(null);
  const { data, error, loading, reload } = useLoader(async () => {
    const { data, error } = await client.from("wa_groups").select("id, wa_name, display_name, tracked, shared").order("wa_name").returns<Group[]>();
    if (error) throw new Error(error.message);
    return data ?? [];
  }, [client]);

  const save = async (group: Group, tracked: boolean, displayName: string, shared: boolean) => {
    setActionError(null);
    const { error: err } = await client.rpc("admin_update_group", {
      p_id: group.id,
      p_tracked: tracked,
      p_display_name: displayName,
      p_shared: shared,
    });
    if (err) setActionError(err.message);
    reload();
  };

  const add = async (name: string, displayName: string) => {
    setActionError(null);
    const { error: err } = await client.rpc("admin_add_group", { p_name: name, p_display_name: displayName });
    if (err) setActionError(err.message);
    reload();
    return !err;
  };

  return (
    <section className="space-y-4">
      <h1 className="font-display text-4xl font-bold text-ink">Grupy</h1>
      <p className="text-sm text-slate-600">
        Grupy WhatsApp wykryte na telefonie lub dodane ręcznie. Treść trafia na serwer tylko ze śledzonych grup; telefon pobiera zmiany w ciągu 15 minut. Grupę wspólną widzi każda rodzina, pozostałe – rodziny, których dzieci do nich chodzą.
      </p>
      {actionError && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {actionError}
        </p>
      )}
      <AddGroupForm onAdd={add} />
      {error && <LoadError message={error} onRetry={reload} />}
      {!data && loading && <Loading />}
      {data && (
        <ul className="divide-y divide-slate-100 rounded-2xl bg-white shadow-sm">
          {data.length === 0 && <li className="p-4 text-slate-500">Telefon nie zgłosił jeszcze żadnych grup. Możesz dodać grupę powyżej.</li>}
          {data.map((g) => (
            <GroupRow key={`${g.id}:${g.display_name}:${g.tracked}:${g.shared}`} group={g} onSave={(t, n, s) => save(g, t, n, s)} />
          ))}
        </ul>
      )}
    </section>
  );
}

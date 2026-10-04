import { useState } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { LoadError, Loading } from "../../components/ui";
import type { Group } from "../../lib/items";
import { useLoader } from "../../lib/useLoader";

function GroupRow({ group, onSave }: { group: Group; onSave: (tracked: boolean, displayName: string) => Promise<void> }) {
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
            onChange={(e) => void onSave(e.target.checked, displayName)}
            className="h-5 w-5 accent-brand-700"
          />
          Śledź
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
          onClick={() => void onSave(group.tracked, displayName)}
          className="rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          Zapisz
        </button>
      </div>
    </li>
  );
}

export function GroupsPage() {
  const { client } = useAuth();
  const [actionError, setActionError] = useState<string | null>(null);
  const { data, error, loading, reload } = useLoader(async () => {
    const { data, error } = await client.from("wa_groups").select("id, wa_name, display_name, tracked").order("wa_name").returns<Group[]>();
    if (error) throw new Error(error.message);
    return data ?? [];
  }, [client]);

  const save = async (group: Group, tracked: boolean, displayName: string) => {
    setActionError(null);
    const { error: err } = await client.rpc("admin_update_group", { p_id: group.id, p_tracked: tracked, p_display_name: displayName });
    if (err) setActionError(err.message);
    reload();
  };

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold text-brand-900">Grupy</h1>
      <p className="text-sm text-slate-600">
        Grupy WhatsApp wykryte na telefonie. Treść trafia na serwer tylko ze śledzonych grup; telefon pobiera zmiany w ciągu 15 minut.
      </p>
      {actionError && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {actionError}
        </p>
      )}
      {error && <LoadError message={error} onRetry={reload} />}
      {!data && loading && <Loading />}
      {data && (
        <ul className="divide-y divide-slate-100 rounded-2xl bg-white shadow-sm">
          {data.length === 0 && <li className="p-4 text-slate-500">Telefon nie zgłosił jeszcze żadnych grup.</li>}
          {data.map((g) => (
            <GroupRow key={`${g.id}:${g.display_name}:${g.tracked}`} group={g} onSave={(t, n) => save(g, t, n)} />
          ))}
        </ul>
      )}
    </section>
  );
}

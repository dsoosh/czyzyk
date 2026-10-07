import { useState, type FormEvent } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { LoadError, Loading } from "../../components/ui";
import {
  CHILD_COLOR_KEYS,
  CHILD_COLORS,
  childColor,
  deleteChild,
  fetchChildren,
  parseAliases,
  saveChild,
  type Child,
  type ChildColor,
} from "../../lib/children";
import { run, type Group } from "../../lib/items";
import { useLoader } from "../../lib/useLoader";

interface Draft {
  id: string | null;
  name: string;
  group_id: string | null;
  /** Other forms of the name, comma-separated as typed. */
  aliases: string;
  /** Chosen colour; null = keep the stored one (or the first free one for a new child). */
  color: ChildColor | null;
}

async function load(db: ReturnType<typeof useAuth>["client"]) {
  const [children, groups] = await Promise.all([
    fetchChildren(db),
    run<Group[]>(db.from("wa_groups").select("id, wa_name, display_name, tracked").eq("tracked", true)),
  ]);
  return { children, groups };
}

/** The family's children: names the assistant matches in messages, and their kindergarten groups. */
export function ChildrenSection() {
  const { client } = useAuth();
  const { data, error, reload } = useLoader(() => load(client), [client]);
  const [adding, setAdding] = useState(false);

  return (
    <section aria-label="Dzieci" className="space-y-3 rounded-[28px] bg-card p-5 shadow-sm">
      <h2 className="font-display text-3xl font-bold text-ink">Dzieci</h2>
      <p className="text-sm text-muted">
        Wpisz imiona tak, jak piszą je nauczycielki (np. „Zosia”), a w „Innych formach imienia” – pełne imię i zdrobnienia (np.
        „Zofia, Zosieńka”). Dzięki temu przy sprawach widać, którego dziecka dotyczą.
      </p>
      {error ? (
        <LoadError message={error} onRetry={reload} />
      ) : !data ? (
        <Loading />
      ) : (
        <>
          {data.children.length === 0 && !adding && <p className="text-muted">Nie dodano jeszcze dzieci.</p>}
          <ul className="space-y-3">
            {data.children.map((c) => (
              // Keyed by the saved values: after a save the form shows them as stored (trimmed forms).
              <li key={`${c.id}:${c.name}:${c.group_id}:${c.aliases.join("|")}`}>
                <ChildForm child={c} all={data.children} groups={data.groups} onSaved={reload} />
              </li>
            ))}
            {adding && (
              <li>
                <ChildForm
                  child={null}
                  all={data.children}
                  groups={data.groups}
                  onSaved={() => {
                    setAdding(false);
                    reload();
                  }}
                  onCancel={() => setAdding(false)}
                />
              </li>
            )}
          </ul>
          {!adding && (
            <button type="button" onClick={() => setAdding(true)} className="rounded-full bg-ink px-5 py-2 font-semibold text-cream">
              Dodaj dziecko
            </button>
          )}
        </>
      )}
    </section>
  );
}

function ChildForm({
  child,
  all,
  groups,
  onSaved,
  onCancel,
}: {
  child: Child | null;
  /** Every child, for the colours already taken. */
  all: Child[];
  groups: Group[];
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const { client } = useAuth();
  const [draft, setDraft] = useState<Draft>({
    id: child?.id ?? null,
    name: child?.name ?? "",
    group_id: child?.group_id ?? null,
    aliases: child?.aliases.join(", ") ?? "",
    color: null,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changed =
    !child ||
    draft.name.trim() !== child.name ||
    draft.group_id !== child.group_id ||
    parseAliases(draft.aliases).join("\n") !== child.aliases.join("\n") ||
    (draft.color !== null && draft.color !== child.color);
  const takenByOthers = new Set(all.filter((c) => c.id !== child?.id).map((c) => childColor(all, c)));
  const shown: ChildColor = draft.color ?? (child ? childColor(all, child) : (CHILD_COLOR_KEYS.find((k) => !takenByOthers.has(k)) ?? "lime"));
  const label = child ? child.name : "Nowe dziecko";

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onSaved();
    } catch (err) {
      const message = String(err);
      setError(
        /należy już do innego dziecka/.test(message)
          ? message.replace(/^Error: /, "").replace("Forma", "Imię lub forma")
          : /Ten kolor|children_color_key/i.test(message)
            ? "Ten kolor ma już inne dziecko."
            : /duplicate|children_name_key/i.test(message)
            ? "Jest już dziecko o tym imieniu."
            : /Najwyżej 10|40 znaków/.test(message)
              ? message.replace(/^Error: /, "")
              : "Nie udało się zapisać.",
      );
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.name.trim() || !changed) return;
    void act(() => saveChild(client, { ...draft, aliases: parseAliases(draft.aliases) }));
  };

  return (
    <form onSubmit={submit} aria-label={label} className="space-y-2 rounded-3xl bg-white p-3">
      <div className="flex flex-wrap gap-2">
        <input
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          maxLength={60}
          placeholder="Imię"
          aria-label="Imię"
          autoFocus={!child}
          className="min-w-0 flex-1 rounded-full border border-sand-400 px-4 py-2"
        />
        <select
          value={draft.group_id ?? ""}
          onChange={(e) => setDraft({ ...draft, group_id: e.target.value || null })}
          aria-label="Grupa"
          className="min-w-0 flex-1 rounded-full border border-sand-400 bg-white px-3 py-2"
        >
          <option value="">— bez grupy —</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.display_name ?? g.wa_name}
            </option>
          ))}
        </select>
      </div>
      <input
        value={draft.aliases}
        onChange={(e) => setDraft({ ...draft, aliases: e.target.value })}
        maxLength={400}
        placeholder="Inne formy imienia, np. Eleonora, El, Elcia"
        aria-label="Inne formy imienia"
        className="w-full rounded-full border border-sand-400 px-4 py-2"
      />
      <div role="radiogroup" aria-label="Kolor" className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">Kolor:</span>
        {CHILD_COLOR_KEYS.map((key) => {
          const taken = takenByOthers.has(key);
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={shown === key}
              aria-label={taken ? `${CHILD_COLORS[key].label} (zajęty)` : CHILD_COLORS[key].label}
              disabled={taken}
              onClick={() => setDraft({ ...draft, color: key })}
              style={{ backgroundColor: CHILD_COLORS[key].bg }}
              className={`h-7 w-7 rounded-full border-2 disabled:opacity-25 ${shown === key ? "border-ink" : "border-transparent"}`}
            />
          );
        })}
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy || !draft.name.trim() || !changed}
          className="rounded-full bg-brand-700 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-45"
        >
          Zapisz
        </button>
        {child ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void act(() => deleteChild(client, child.id))}
            className="rounded-full px-4 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50"
          >
            Usuń
          </button>
        ) : (
          <button type="button" onClick={onCancel} className="rounded-full px-4 py-1.5 text-sm font-semibold text-muted hover:bg-ink/5">
            Anuluj
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}

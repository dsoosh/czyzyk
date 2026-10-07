import { CONTACT_ROLE_LABELS, mentionsFamily, roleOf } from "@czyzyk/shared/contacts";
import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import { useAuth, useProfile } from "../../auth/AuthProvider";
import { LoadError, Loading } from "../../components/ui";
import { dayLabel, warsawDay, warsawTime } from "../../lib/dates";
import { fetchContactRoles } from "../../lib/contacts";
import { fetchGroupHistory, HISTORY_PAGE, reprocessMessage } from "../../lib/history";
import { useLoader, useOnForeground } from "../../lib/useLoader";

/** Why a message skipped the full analysis (message-triage). */
const TRIAGE_LABELS = { rules: "pominięte – pogawędka", model: "pominięte – wstępna ocena" } as const;

/** History of one tracked group: newest messages, older ones on demand, text search. */
export function GroupHistoryPage() {
  const { id = "" } = useParams();
  // A new group starts from a fresh page and search.
  return <GroupHistory key={id} id={id} />;
}

function GroupHistory({ id }: { id: string }) {
  const { client } = useAuth();
  const isAdmin = useProfile().role === "admin";
  // Message id → state of an admin's "analyse again" request.
  const [reprocess, setReprocess] = useState<Record<string, "pending" | "queued" | "failed">>({});
  const [limit, setLimit] = useState(HISTORY_PAGE);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const { data, error, loading, reload } = useLoader(
    () => fetchGroupHistory(client, id, limit, query),
    [client, id, limit, query],
  );
  // Roles the family gave authors (contact-roles); history works without them.
  const roles = useLoader(() => fetchContactRoles(client).catch(() => []), [client]).data ?? [];
  useOnForeground(reload);

  const analyseAgain = async (messageId: string) => {
    setReprocess((r) => ({ ...r, [messageId]: "pending" }));
    try {
      await reprocessMessage(client, messageId);
      setReprocess((r) => ({ ...r, [messageId]: "queued" }));
    } catch {
      setReprocess((r) => ({ ...r, [messageId]: "failed" }));
    }
  };

  const search = (e: FormEvent) => {
    e.preventDefault();
    setLimit(HISTORY_PAGE);
    setQuery(draft.trim());
  };

  if (error) return <LoadError message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  if (!data.group) return <p className="text-slate-600">Nie znaleziono grupy.</p>;

  const today = warsawDay(new Date());
  const name = data.group.display_name ?? data.group.wa_name;

  return (
    <article className="space-y-4">
      <Link to="/czaty" className="text-sm text-brand-700">
        ← Czaty
      </Link>
      <h1 className="font-display text-4xl font-bold text-ink">{name}</h1>

      <form role="search" onSubmit={search} className="flex gap-2">
        <input
          type="search"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Szukaj w wiadomościach"
          aria-label="Szukaj w wiadomościach"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2"
        />
        <button type="submit" className="rounded-lg bg-brand-700 px-4 py-2 font-semibold text-white">
          Szukaj
        </button>
      </form>
      {query && (
        <p className="text-sm text-slate-600">
          Wyniki dla „{query}”{" "}
          <button
            type="button"
            className="text-brand-700 underline"
            onClick={() => {
              setDraft("");
              setLimit(HISTORY_PAGE);
              setQuery("");
            }}
          >
            wyczyść
          </button>
        </p>
      )}

      {data.hasMore && (
        <button
          type="button"
          className="text-sm text-brand-700 underline"
          disabled={loading}
          onClick={() => setLimit((l) => l + HISTORY_PAGE)}
        >
          Wcześniejsze wiadomości
        </button>
      )}

      {data.messages.length === 0 ? (
        <p className="rounded-2xl bg-white p-4 text-slate-500 shadow-sm">{query ? "Nic nie znaleziono." : "Brak wiadomości."}</p>
      ) : (
        <ol aria-label="Wiadomości" className="space-y-2">
          {data.messages.map((m, i) => {
            const day = warsawDay(m.sent_at);
            const newDay = i === 0 || warsawDay(data.messages[i - 1]!.sent_at) !== day;
            const role = roleOf(roles, m.author);
            const toFamily = role?.role !== "rodzina" && mentionsFamily(roles, m.text);
            return (
              <li key={m.id} className="space-y-2">
                {newDay && (
                  <p role="separator" className="pt-2 text-center font-display text-xl font-bold text-slate-500">
                    {dayLabel(day, today)}
                  </p>
                )}
                <div className={`rounded-2xl p-3 shadow-sm ${role?.role === "rodzina" ? "bg-sun/25" : toFamily ? "bg-air/40" : "bg-white"}`}>
                  <div className="flex justify-between gap-2 text-xs text-slate-500">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-slate-700">{m.author}</span>
                      {role && (
                        <span title={role.label ?? undefined} className="rounded-full bg-sand px-2 py-0.5 font-semibold text-ink">
                          {role.label ?? CONTACT_ROLE_LABELS[role.role]}
                        </span>
                      )}
                      {toFamily && <span className="rounded-full bg-water/20 px-2 py-0.5 font-semibold text-brand-700">do Was</span>}
                    </span>
                    <span>{warsawTime(m.sent_at)}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap">{m.text || (m.has_attachment ? "📎 załącznik" : "")}</p>
                  {m.text && m.has_attachment && <p className="mt-1 text-xs text-slate-500">📎 załącznik</p>}
                  {m.status === "deleted_suspected" && <p className="mt-1 text-xs text-red-700">Prawdopodobnie usunięta z grupy</p>}
                  {isAdmin && m.status === "active" && (
                    <div className="mt-1 flex items-center justify-end gap-2 text-xs">
                      {m.triage && reprocess[m.id] !== "queued" && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600" title="Ta wiadomość nie trafiła do pełnej analizy">
                          {TRIAGE_LABELS[m.triage]}
                        </span>
                      )}
                      {reprocess[m.id] === "queued" ? (
                        <span role="status" className="text-slate-500">
                          Wiadomość wróciła do analizy – nowe sprawy pojawią się za chwilę.
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={reprocess[m.id] === "pending"}
                          onClick={() => void analyseAgain(m.id)}
                          className="text-brand-700 underline disabled:opacity-50"
                        >
                          {reprocess[m.id] === "failed" ? "Nie udało się – spróbuj ponownie" : "Analizuj ponownie"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </article>
  );
}

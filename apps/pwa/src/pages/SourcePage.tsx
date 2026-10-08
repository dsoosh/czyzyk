import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { MessageText } from "../components/MessageText";
import { LoadError, Loading } from "../components/ui";
import { dayLabel, warsawDay, warsawTime } from "../lib/dates";
import {
  confidenceLabel,
  fetchSource,
  itemTitle,
  ITEM_TABLES,
  type ContextMessage,
  type ItemChange,
  type ItemKind,
  type SourceData,
} from "../lib/items";
import { useLoader } from "../lib/useLoader";
import { FIELD_LABELS, formatValue, OP_LABELS } from "../lib/changes";

const KIND_LABELS: Record<ItemKind, string> = {
  event: "Wydarzenie",
  bring_item: "Do przyniesienia",
  payment: "Płatność",
  action_required: "Wymaga odpowiedzi",
  closure: "Dzień wolny",
  fact: "Ściągawka",
};

/** "Skąd to wiem": the source messages of an item, highlighted within the conversation. */
export function SourcePage() {
  const { kind = "", id = "" } = useParams();
  const navigate = useNavigate();
  const { client } = useAuth();
  const [before, setBefore] = useState(10);
  const validKind = kind in ITEM_TABLES ? (kind as ItemKind) : null;
  const { data, error, loading, reload } = useLoader(
    () => (validKind ? fetchSource(client, validKind, id, before) : Promise.resolve<SourceData>({ item: null, messages: [], history: [], sources: [] })),
    [client, validKind, id, before],
  );

  if (error) return <LoadError message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  if (!validKind || !data.item) return <p className="text-slate-600">Nie znaleziono elementu.</p>;

  const sources = new Set([...data.item.source_message_ids, ...data.sources.map((m) => m.id)]);
  const byId = new Map(data.sources.map((m) => [m.id, m]));
  const today = warsawDay(new Date());

  return (
    <article className="space-y-4">
      <button type="button" onClick={() => navigate(-1)} className="text-sm text-brand-700">
        ← Wróć
      </button>
      <header className="space-y-1">
        <p className="text-sm text-slate-500">{KIND_LABELS[validKind]}</p>
        <h1 className="font-display text-4xl font-bold text-ink">{itemTitle(validKind, data.item)}</h1>
      </header>
      <div className="space-y-1 rounded-2xl bg-white p-4 shadow-sm">
        <p>
          <span className="font-semibold">Pewność: {confidenceLabel(data.item.confidence)}</span>
        </p>
        {data.item.rationale && <p className="text-slate-700">{data.item.rationale}</p>}
        {data.item.status === "needs_review" && <p className="text-sm text-amber-700">Czeka na sprawdzenie przez administratora.</p>}
      </div>

      {data.history.length > 0 ? (
        <section aria-label="Historia zmian" className="space-y-2">
          <h2 className="font-display text-xl font-bold text-ink">Historia zmian</h2>
          <ol className="space-y-2">
            {[...data.history].reverse().map((change) => (
              <ChangeEntry key={change.id} change={change} sources={change.source_message_ids.map((sid) => byId.get(sid)).filter((m) => m != null)} today={today} />
            ))}
          </ol>
        </section>
      ) : (
        data.sources.length > 1 && (
          <section aria-label="Wiadomości źródłowe" className="space-y-2">
            <h2 className="font-display text-xl font-bold text-ink">Wiadomości źródłowe</h2>
            <ol className="space-y-2">
              {data.sources.map((m) => (
                <li key={m.id} className="rounded-2xl bg-white p-3 shadow-sm">
                  <SourceQuote message={m} today={today} />
                </li>
              ))}
            </ol>
          </section>
        )
      )}

      {data.messages.length === 0 ? (
        <p className="text-slate-500">Brak wiadomości źródłowej.</p>
      ) : (
        <section aria-label="Rozmowa" className="space-y-2">
          <button
            type="button"
            className="text-sm text-brand-700 underline"
            disabled={loading}
            onClick={() => setBefore((b) => b + 10)}
          >
            Wcześniejsze wiadomości
          </button>
          <ol className="space-y-2">
            {data.messages.map((m) => {
              const isSource = sources.has(m.id);
              return (
                <li
                  key={m.id}
                  aria-current={isSource ? "true" : undefined}
                  className={`rounded-2xl p-3 ${isSource ? "border-2 border-accent bg-yellow-50" : "bg-white"} shadow-sm`}
                >
                  <div className="flex justify-between gap-2 text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">{m.author}</span>
                    <span>
                      {dayLabel(warsawDay(m.sent_at), today)} {warsawTime(m.sent_at)}
                    </span>
                  </div>
                  <MessageText className="mt-1" text={m.text || (m.has_attachment ? "📎 załącznik" : "")} />
                  {m.status === "deleted_suspected" && <p className="mt-1 text-xs text-red-700">Prawdopodobnie usunięta z grupy</p>}
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </article>
  );
}

function ChangeEntry({ change, sources, today }: { change: ItemChange; sources: ContextMessage[]; today: string }) {
  const fields =
    change.op === "update" && change.changes
      ? Object.entries(change.changes as Record<string, { from: unknown; to: unknown }>)
      : [];
  return (
    <li className="space-y-2 rounded-2xl bg-white p-3 shadow-sm">
      <div className="flex justify-between gap-2 text-xs text-slate-500">
        <span className="font-semibold text-slate-700">{OP_LABELS[change.op]}</span>
        <span>
          {dayLabel(warsawDay(change.created_at), today)} {warsawTime(change.created_at)}
        </span>
      </div>
      {fields.length > 0 && (
        <ul className="space-y-0.5 text-sm">
          {fields.map(([field, { from, to }]) => (
            <li key={field}>
              <span className="text-slate-500">{FIELD_LABELS[field] ?? field}:</span> <span className="line-through">{formatValue(field, from)}</span>{" "}
              → <span className="font-semibold">{formatValue(field, to)}</span>
            </li>
          ))}
        </ul>
      )}
      {change.rationale && <p className="text-sm text-slate-700">{change.rationale}</p>}
      {sources.map((m) => (
        <blockquote key={m.id} className="border-l-4 border-accent pl-3">
          <SourceQuote message={m} today={today} />
        </blockquote>
      ))}
    </li>
  );
}

function SourceQuote({ message, today }: { message: ContextMessage; today: string }) {
  return (
    <>
      <div className="flex justify-between gap-2 text-xs text-slate-500">
        <span className="font-semibold text-slate-700">{message.author}</span>
        <span>
          {dayLabel(warsawDay(message.sent_at), today)} {warsawTime(message.sent_at)}
        </span>
      </div>
      <MessageText className="mt-1 text-sm" text={message.text || (message.has_attachment ? "📎 załącznik" : "")} />
    </>
  );
}

import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { FIELD_LABELS, formatValue, OP_LABELS } from "../lib/changes";
import { dayLabel, warsawDay, warsawTime } from "../lib/dates";
import {
  fetchDocumentImage,
  fetchEventHistory,
  type ContextMessage,
  type EventChange,
  type EventHistory as History,
  type MessageDocument,
} from "../lib/items";
import { useLoader } from "../lib/useLoader";
import { LoadError, Loading } from "./ui";

type Entry = { at: string; message: ContextMessage } | { at: string; change: EventChange };

/** Messages and changes in one timeline, oldest first; a change follows the messages it came from. */
export function timeline(history: History): Entry[] {
  const entries: Entry[] = [
    ...history.messages.map((message) => ({ at: message.sent_at, message })),
    ...history.changes.map((change) => ({ at: change.created_at, change })),
  ];
  return entries.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

/** "Historia" on the event page (event-history): every message, document and change behind the event. */
export function EventHistory({ eventId }: { eventId: string }) {
  const { client } = useAuth();
  const { data, error, loading, reload } = useLoader(() => fetchEventHistory(client, eventId), [client, eventId]);
  if (error) return <LoadError message={error} onRetry={reload} />;
  if (!data) return loading ? <Loading /> : null;

  const entries = timeline(data);
  const today = warsawDay(new Date());
  const docsByMessage = new Map<string, MessageDocument[]>();
  for (const d of data.documents) docsByMessage.set(d.message_id, [...(docsByMessage.get(d.message_id) ?? []), d]);

  return (
    <section aria-label="Historia" className="space-y-2">
      <h2 className="font-display text-2xl font-bold text-ink">Historia</h2>
      {entries.length === 0 ? (
        <p className="text-slate-500">Brak wiadomości o tym wydarzeniu.</p>
      ) : (
        <ol className="space-y-2">
          {entries.map((entry) =>
            "message" in entry ? (
              <MessageEntry key={`m${entry.message.id}`} message={entry.message} documents={docsByMessage.get(entry.message.id) ?? []} today={today} />
            ) : (
              <ChangeEntry key={`c${entry.change.id}`} change={entry.change} bringNames={data.bringNames} today={today} />
            ),
          )}
        </ol>
      )}
    </section>
  );
}

function When({ at, today }: { at: string; today: string }) {
  return (
    <span>
      {dayLabel(warsawDay(at), today)} {warsawTime(at)}
    </span>
  );
}

function MessageEntry({ message, documents, today }: { message: ContextMessage; documents: MessageDocument[]; today: string }) {
  return (
    <li className="space-y-2 rounded-2xl bg-white p-3 shadow-sm">
      <div className="flex justify-between gap-2 text-xs text-slate-500">
        <span className="font-semibold text-slate-700">{message.author}</span>
        <When at={message.sent_at} today={today} />
      </div>
      {(message.text || documents.length === 0) && (
        <p className="whitespace-pre-wrap">{message.text || (message.has_attachment ? "📎 załącznik" : "")}</p>
      )}
      {documents.map((d) => (
        <DocumentView key={d.id} document={d} />
      ))}
      {message.status === "deleted_suspected" && <p className="text-xs text-red-700">Prawdopodobnie usunięta z grupy</p>}
    </li>
  );
}

/** The image of a checked document, or the text read from it when only the text was kept. */
function DocumentView({ document }: { document: MessageDocument }) {
  const { client } = useAuth();
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (document.screening !== "image") return;
    let alive = true;
    fetchDocumentImage(client, document.id).then(
      (url) => alive && setSrc(url),
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
    };
  }, [client, document.id, document.screening]);

  const label = document.description ?? "Zdjęcie dokumentu";
  return (
    <figure className="space-y-1">
      {src ? (
        <a href={src} target="_blank" rel="noreferrer">
          <img src={src} alt={label} className="max-h-96 w-full rounded-xl border border-slate-200 object-contain" />
        </a>
      ) : document.screening === "image" && !failed ? (
        <p className="text-sm text-slate-500">Wczytywanie zdjęcia…</p>
      ) : null}
      <figcaption className="text-sm text-slate-600">📄 {label}</figcaption>
      {!src && document.doc_text && (
        <details className="text-sm">
          <summary className="cursor-pointer text-brand-700">Tekst z dokumentu</summary>
          <p className="mt-1 whitespace-pre-wrap text-slate-700">{document.doc_text}</p>
        </details>
      )}
    </figure>
  );
}

function ChangeEntry({ change, bringNames, today }: { change: EventChange; bringNames: Record<string, string>; today: string }) {
  const fields =
    change.op === "update" && change.changes ? Object.entries(change.changes as Record<string, { from: unknown; to: unknown }>) : [];
  const subject = change.item_type === "bring_item" ? `Do przyniesienia: ${bringNames[change.item_id] ?? "rzecz"}` : null;
  return (
    <li className="space-y-1 rounded-2xl border-l-4 border-accent bg-yellow-50 p-3 text-sm shadow-sm">
      <div className="flex justify-between gap-2 text-xs text-slate-500">
        <span className="font-semibold text-slate-700">
          {OP_LABELS[change.op]}
          {subject && ` · ${subject}`}
        </span>
        <When at={change.created_at} today={today} />
      </div>
      {fields.length > 0 && (
        <ul className="space-y-0.5">
          {fields.map(([field, { from, to }]) => (
            <li key={field}>
              <span className="text-slate-500">{FIELD_LABELS[field] ?? field}:</span> <span className="line-through">{formatValue(field, from)}</span> →{" "}
              <span className="font-semibold">{formatValue(field, to)}</span>
            </li>
          ))}
        </ul>
      )}
      {change.rationale && <p className="text-slate-700">{change.rationale}</p>}
    </li>
  );
}

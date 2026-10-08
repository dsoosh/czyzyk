import { Link } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { shortDate, warsawDay, warsawTime } from "../lib/dates";
import type { ContextMessage, ItemKind } from "../lib/items";
import { fetchMessageDetails, verdictLabel, type MessageCall, type MessageItem } from "../lib/messageDetails";
import { useLoader } from "../lib/useLoader";

const KIND_LABELS: Record<ItemKind, string> = {
  event: "Wydarzenie",
  bring_item: "Do przyniesienia",
  payment: "Płatność",
  action_required: "Wymaga odpowiedzi",
  closure: "Dzień wolny",
  fact: "Ściągawka",
};

const OP_LABELS = { create: "utworzone", update: "zmienione", cancel: "odwołane" } as const;
const CALL_LABELS: Record<MessageCall["kind"], string> = { triage: "Wstępna ocena", extraction: "Analiza", document: "Kontrola zdjęcia" };

function itemLink(item: MessageItem): string {
  return item.kind === "event" ? `/kalendarz/wydarzenie/${item.id}` : `/zrodlo/${item.kind}/${item.id}`;
}

function callResult(c: MessageCall): string {
  if (c.error) return "błąd";
  if (c.kind === "triage") return c.response?.relevant ? "do analizy" : "pominięte";
  if (c.kind === "document") return c.response?.containsPeople ? "ludzie – obraz usunięty" : "dokument";
  const n = c.response?.operations?.length ?? 0;
  return n === 0 ? "bez operacji" : n === 1 ? "1 operacja" : `${n} operacje`;
}

/** Under a tapped message in the chat (message-details): the verdict, its items and, for admins, the model calls. */
export function MessageDetailsPanel({ message, admin }: { message: ContextMessage; admin: boolean }) {
  const { client } = useAuth();
  const { data, error } = useLoader(() => fetchMessageDetails(client, message.id, admin), [client, message.id, admin]);
  return (
    <div aria-label="Szczegóły wiadomości" className="mt-2 space-y-2 border-t border-slate-200 pt-2 text-sm" onClick={(e) => e.stopPropagation()}>
      <p>
        <span className="text-slate-500">Analiza: </span>
        <span className="font-semibold">{verdictLabel(message)}</span>
      </p>
      {error && <p className="text-red-700">Nie udało się wczytać szczegółów.</p>}
      {!data && !error && <p className="text-slate-500">Wczytywanie…</p>}
      {data && (
        <>
          {data.items.length > 0 ? (
            <ul aria-label="Sprawy z tej wiadomości" className="space-y-1">
              {data.items.map((item) => (
                <li key={`${item.kind}:${item.id}`}>
                  <Link to={itemLink(item)} className="text-brand-700 underline underline-offset-2">
                    {KIND_LABELS[item.kind]}: {item.title || "(bez nazwy)"}
                  </Link>
                  <span className="text-xs text-slate-500">
                    {item.ops.length > 0 && ` · ${item.ops.map((op) => OP_LABELS[op]).join(", ")}`}
                    {item.status === "needs_review" && " · czeka na przegląd"}
                    {item.status === "cancelled" && " · odwołane"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            message.processed_at && !message.triage && <p className="text-slate-500">Nie powstały z niej żadne sprawy.</p>
          )}
          {admin && data.calls.length > 0 && (
            <ul aria-label="Wywołania modelu" className="space-y-1 text-xs">
              {data.calls.map((c) => (
                <li key={c.id}>
                  <Link to={`/admin/llm?wywolanie=${c.id}`} className="text-brand-700 underline underline-offset-2">
                    {CALL_LABELS[c.kind]}: {callResult(c)}
                  </Link>
                  <span className="text-slate-500">
                    {" "}
                    · {shortDate(warsawDay(c.created_at))} {warsawTime(c.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

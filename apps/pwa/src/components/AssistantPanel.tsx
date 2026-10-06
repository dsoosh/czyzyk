import type { AssistantTurn } from "@czyzyk/shared/assistant";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { ASSISTANT_ERRORS, AssistantError, askAssistant, viewForLocation, viewLabel } from "../lib/assistant";
import { readPublicEnv } from "../lib/env";

/** Exchanges sent back as context (the API accepts up to 10). */
const HISTORY_EXCHANGES = 10;

/**
 * "Zapytaj": a floating button and a sheet with a conversation about the current
 * screen. The conversation survives navigation; each question carries the screen
 * it was asked on, and the API loads that screen's data.
 */
export function AssistantPanel() {
  const { client } = useAuth();
  const location = useLocation();
  const view = viewForLocation(location.pathname, location.search);
  const apiUrl = readPublicEnv().apiUrl;
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<AssistantTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => endRef.current?.scrollIntoView?.({ block: "end" }), [turns, busy]);

  if (!view || !apiUrl) return null;

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const question = draft.trim();
    if (!question || busy) return;
    setBusy(true);
    setError(null);
    try {
      const history = turns.slice(-HISTORY_EXCHANGES * 2);
      const answer = await askAssistant(client, apiUrl, { view, question, history });
      setTurns((t) => [...t, { role: "user", content: question }, { role: "assistant", content: answer }]);
      setDraft("");
    } catch (err) {
      setError(ASSISTANT_ERRORS[err instanceof AssistantError ? err.reason : "failed"]);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-20 z-20 rounded-full bg-sun px-5 py-2 font-display text-2xl font-bold text-ink shadow-lg hover:brightness-95"
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      >
        Zapytaj
      </button>
    );
  }

  return (
    <section
      role="dialog"
      aria-label="Zapytaj asystenta"
      className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-h-[80vh] max-w-lg flex-col rounded-t-3xl border-t-4 border-water bg-white shadow-2xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <header className="flex items-start gap-2 px-4 pt-3">
        <div className="flex-1">
          <h2 className="font-display text-3xl font-bold text-ink">Zapytaj</h2>
          <p className="text-sm text-slate-500">O: {viewLabel(view)}</p>
        </div>
        {turns.length > 0 && (
          <button type="button" className="pt-2 text-sm text-brand-700 underline" onClick={() => setTurns([])}>
            Nowa rozmowa
          </button>
        )}
        <button type="button" aria-label="Zamknij" className="px-2 pt-1 text-2xl text-slate-500" onClick={() => setOpen(false)}>
          ×
        </button>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {turns.length === 0 && (
          <p className="text-sm text-slate-500">
            Np. „Co trzeba przygotować na jutro?”, „Kiedy jest pasowanie?”, „Co pisali o wycieczce?”
          </p>
        )}
        <ol aria-label="Rozmowa" className="space-y-2">
          {turns.map((t, i) => (
            <li
              key={i}
              className={`max-w-[85%] rounded-2xl px-3 py-2 whitespace-pre-wrap ${
                t.role === "user" ? "ml-auto bg-brand-100 text-ink" : "bg-brand-50 text-slate-800"
              }`}
            >
              <span className="sr-only">{t.role === "user" ? "Ty: " : "Asystent: "}</span>
              {t.content}
            </li>
          ))}
        </ol>
        {busy && <p className="text-sm text-slate-500">Asystent myśli…</p>}
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 p-2 text-sm text-red-800">
            {error}
          </p>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={send} className="flex gap-2 border-t border-slate-100 px-4 py-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={1000}
          placeholder="Twoje pytanie"
          aria-label="Twoje pytanie"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2"
        />
        <button type="submit" disabled={busy || !draft.trim()} className="rounded-lg bg-brand-700 px-4 py-2 font-semibold text-white disabled:opacity-50">
          Wyślij
        </button>
      </form>
      <p className="px-4 pb-2 text-xs text-slate-400">Odpowiedzi tworzy model językowy na podstawie danych tego ekranu – ważne rzeczy sprawdź w źródle.</p>
    </section>
  );
}

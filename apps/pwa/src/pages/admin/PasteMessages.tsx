import { parseChatExport } from "@czyzyk/shared/chat-export";
import { useMemo, useState, type FormEvent } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { ImportError, pasteMessages, type PasteSummary } from "../../lib/chatImport";
import { warsawInstant } from "../../lib/dates";
import type { Group } from "../../lib/items";

/**
 * Admin → Import: messages copied from WhatsApp and pasted here (manual-entry). Several
 * copied messages carry "[18:02, 7.10.2026] Autor:" headers; a single one is plain text,
 * so the admin may give its author and time.
 */
export function PasteMessages({ groups, apiUrl, initialGroupId }: { groups: Group[]; apiUrl: string | null; initialGroupId: string }) {
  const { client } = useAuth();
  const [groupId, setGroupId] = useState(groups.some((g) => g.id === initialGroupId) ? initialGroupId : "");
  const [text, setText] = useState("");
  const [author, setAuthor] = useState("");
  const [sentAt, setSentAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<PasteSummary | null>(null);

  const copied = useMemo(() => (text.trim() ? parseChatExport(text).messages.length : 0), [text]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!groupId || !text.trim() || !apiUrl) return;
    setBusy(true);
    setError(null);
    setSummary(null);
    try {
      const body: { group_id: string; text: string; author?: string; sent_at?: string } = { group_id: groupId, text };
      if (!copied && author.trim()) body.author = author.trim();
      if (!copied && sentAt) body.sent_at = warsawInstant(sentAt.slice(0, 10), sentAt.slice(11, 16)).toISOString();
      setSummary(await pasteMessages(client, apiUrl, body));
      setText("");
      setAuthor("");
      setSentAt("");
    } catch (err) {
      setError(err instanceof ImportError ? err.message : "Nie udało się dodać wiadomości.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} aria-label="Wklej wiadomości" className="space-y-4 rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="font-display text-2xl font-bold text-ink">Wklej wiadomości</h2>
      <p className="text-sm text-slate-600">
        W WhatsAppie przytrzymaj wiadomość (możesz zaznaczyć kilka) i wybierz <strong>Kopiuj</strong>, a potem wklej tutaj. Wiadomości
        trafią do analizy tak jak te z powiadomień.
      </p>

      <label className="block text-sm font-medium">
        Do grupy
        <select
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
          required
          className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2"
        >
          <option value="">– wybierz –</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.display_name ?? g.wa_name}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm font-medium">
        Treść
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          maxLength={20_000}
          required
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal"
        />
      </label>

      {copied > 0 ? (
        <p role="status" aria-label="Rozpoznane wiadomości" className="rounded-xl bg-brand-50 p-3 text-sm">
          Rozpoznano {copied} {copied === 1 ? "wiadomość" : "wiadomości"} z autorem i godziną.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Kto napisał (opcjonalnie)
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              maxLength={200}
              placeholder="np. Pani Ania"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal"
            />
          </label>
          <label className="block text-sm font-medium">
            Kiedy (opcjonalnie, domyślnie teraz)
            <input
              type="datetime-local"
              value={sentAt}
              onChange={(e) => setSentAt(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal"
            />
          </label>
        </div>
      )}

      <button
        type="submit"
        disabled={busy || !groupId || !text.trim() || !apiUrl}
        className="w-full rounded-lg bg-brand-700 py-2 font-semibold text-white disabled:opacity-50"
      >
        {busy ? "Dodawanie…" : "Dodaj wiadomości"}
      </button>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
      {summary && (
        <p role="status" aria-label="Wynik wklejenia" className="rounded-xl bg-brand-50 p-3 text-sm">
          {summary.inserted > 0
            ? `Dodano: ${summary.inserted}. Wyniki analizy pojawią się w ciągu kilku minut.`
            : "Te wiadomości już są w aplikacji."}
          {summary.inserted > 0 && summary.duplicates > 0 && ` Pominięte (już były): ${summary.duplicates}.`}
        </p>
      )}
    </form>
  );
}

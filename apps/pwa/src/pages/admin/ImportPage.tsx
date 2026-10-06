import { matchGroupByFileName, parseChatExport } from "@czyzyk/shared/chat-export";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { LoadError, Loading } from "../../components/ui";
import { importChat, ImportError, readChatExport, type ImportSummary } from "../../lib/chatImport";
import { readPublicEnv } from "../../lib/env";
import { run, type Group } from "../../lib/items";
import { useLoader } from "../../lib/useLoader";

interface Selected {
  fileName: string;
  text: string;
  messages: number;
  attachments: number;
  from: string;
  to: string;
}

const PERIODS = [
  { days: 7, label: "z ostatnich 7 dni" },
  { days: 30, label: "z ostatnich 30 dni" },
  { days: 90, label: "z ostatnich 90 dni" },
  { days: 3650, label: "wszystkie" },
  { days: 0, label: "żadne – tylko historia" },
];

const day = (localTime: string) => {
  const [y, m, d] = localTime.slice(0, 10).split("-");
  return `${Number(d)}.${m}.${y}`;
};

/** Admin → Import: a WhatsApp chat export (text only) for one tracked group. */
export function ImportPage() {
  const { client } = useAuth();
  const apiUrl = readPublicEnv().apiUrl;
  const groups = useLoader(
    () => run<Group[]>(client.from("wa_groups").select("id, wa_name, display_name, tracked").eq("tracked", true).order("wa_name")),
    [client],
  );
  const [selected, setSelected] = useState<Selected | null>(null);
  const [groupId, setGroupId] = useState("");
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  const choose = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setSelected(null);
    setSummary(null);
    setError(null);
    if (!file) return;
    setBusy(true);
    try {
      const text = await readChatExport(file);
      const { messages } = parseChatExport(text);
      if (messages.length === 0) throw new ImportError("Nie rozpoznano żadnych wiadomości w pliku. Czy to eksport czatu z WhatsAppa?");
      setSelected({
        fileName: file.name,
        text,
        messages: messages.length,
        attachments: messages.filter((m) => m.hasAttachment).length,
        from: messages[0]!.localTime,
        to: messages[messages.length - 1]!.localTime,
      });
      const match = matchGroupByFileName(file.name, groups.data ?? []);
      if (match) setGroupId(match.id);
    } catch (err) {
      setError(err instanceof ImportError ? err.message : "Nie udało się odczytać pliku.");
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected || !groupId || !apiUrl) return;
    setBusy(true);
    setError(null);
    try {
      setSummary(await importChat(client, apiUrl, { group_id: groupId, text: selected.text, extract_days: days }));
      setSelected(null);
    } catch (err) {
      setError(err instanceof ImportError ? err.message : "Import nie powiódł się.");
    } finally {
      setBusy(false);
    }
  };

  if (groups.error) return <LoadError message={groups.error} onRetry={groups.reload} />;
  if (!groups.data) return <Loading />;

  return (
    <div className="space-y-4">
      <h1 className="font-display text-4xl font-bold text-ink">Import eksportu czatu</h1>
      <div className="space-y-2 rounded-2xl bg-white p-4 text-sm text-slate-600 shadow-sm">
        <p>
          W WhatsAppie otwórz grupę → <strong>⋮ → Więcej → Eksportuj czat</strong> i zapisz plik. Możesz wybrać „Bez multimediów” albo
          „Dołącz multimedia” – z paczki ZIP odczytywany jest tylko tekst czatu, a zdjęcia i filmy nie opuszczają tego urządzenia.
        </p>
        <p>Wiadomości, które już są w aplikacji (np. z powiadomień), zostaną pominięte.</p>
      </div>

      {!apiUrl && (
        <p role="alert" className="text-sm text-red-700">
          Brak adresu serwera (VITE_API_URL) – import jest niedostępny.
        </p>
      )}
      {groups.data.length === 0 && (
        <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">Najpierw włącz śledzenie grupy w zakładce Grupy.</p>
      )}

      <form onSubmit={submit} aria-label="Import eksportu" className="space-y-4 rounded-2xl bg-white p-4 shadow-sm">
        <label className="block text-sm font-medium">
          Plik eksportu (.txt lub .zip)
          <input
            type="file"
            accept=".txt,.zip,text/plain,application/zip"
            onChange={(e) => void choose(e)}
            disabled={busy}
            className="mt-1 block w-full text-sm"
          />
        </label>

        {selected && (
          <div role="status" aria-label="Podgląd" className="rounded-xl bg-brand-50 p-3 text-sm">
            <p className="font-semibold">
              {selected.messages} wiadomości · {day(selected.from)}–{day(selected.to)}
            </p>
            {selected.attachments > 0 && (
              <p className="text-slate-600">{selected.attachments} z załącznikiem – zapisane bez plików, tylko jako informacja o załączniku.</p>
            )}
          </div>
        )}

        <label className="block text-sm font-medium">
          Grupa
          <select
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2"
          >
            <option value="">– wybierz –</option>
            {groups.data.map((g) => (
              <option key={g.id} value={g.id}>
                {g.display_name ?? g.wa_name}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-medium">
          Wyciągnij wydarzenia z nowych wiadomości
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2"
          >
            {PERIODS.map((p) => (
              <option key={p.days} value={p.days}>
                {p.label}
              </option>
            ))}
          </select>
          <span className="mt-1 block font-normal text-slate-500">Starsze wiadomości zostaną zapisane jako historia, bez analizy.</span>
        </label>

        <button
          type="submit"
          disabled={busy || !selected || !groupId || !apiUrl}
          className="w-full rounded-lg bg-brand-700 py-2 font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Przetwarzanie…" : "Importuj"}
        </button>
      </form>

      {error && (
        <p role="alert" className="rounded-2xl bg-red-50 p-4 text-sm text-red-800">
          {error}
        </p>
      )}
      {summary && (
        <div role="status" aria-label="Wynik importu" className="space-y-1 rounded-2xl bg-white p-4 text-sm shadow-sm">
          <p className="font-semibold text-brand-800">Zaimportowano.</p>
          <p>Nowe wiadomości: {summary.inserted}</p>
          <p>Pominięte (już były): {summary.duplicates}</p>
          <p>Do analizy: {summary.for_extraction} – wyniki pojawią się w ciągu kilku minut.</p>
        </div>
      )}
    </div>
  );
}

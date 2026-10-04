import { useState } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { LoadError, Loading } from "../../components/ui";
import { calendarLinks, type CalendarLinks } from "../../lib/calendarLinks";
import { shortDate, warsawDay } from "../../lib/dates";
import { readPublicEnv } from "../../lib/env";
import { run } from "../../lib/items";
import { useLoader } from "../../lib/useLoader";

const linkClass = "rounded-lg border border-slate-300 px-3 py-2 text-center text-sm font-semibold";

/** "Mój kalendarz": a private iCal link, shown only once right after it is generated. */
export function CalendarSubscription() {
  const { client } = useAuth();
  const apiUrl = readPublicEnv().apiUrl;
  const active = useLoader(
    () => run<{ created_at: string }[]>(client.from("ical_tokens").select("created_at").is("revoked_at", null)),
    [client],
  );
  const [links, setLinks] = useState<CalendarLinks | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const generate = async () => {
    setBusy(true);
    setMessage(null);
    const { data, error } = await client.rpc("create_ical_token");
    setBusy(false);
    if (error || typeof data !== "string" || !apiUrl) return setMessage("Nie udało się utworzyć linku.");
    setLinks(calendarLinks(apiUrl, data));
    active.reload();
  };

  const revoke = async () => {
    setBusy(true);
    const { error } = await client.rpc("revoke_ical_token");
    setBusy(false);
    if (error) return setMessage("Nie udało się unieważnić linku.");
    setLinks(null);
    setMessage("Link unieważniony. Kalendarze, które go używały, przestaną się odświeżać.");
    active.reload();
  };

  const copy = async () => {
    if (!links) return;
    try {
      await navigator.clipboard.writeText(links.https);
      setMessage("Skopiowano link.");
    } catch {
      setMessage("Nie udało się skopiować – zaznacz link ręcznie.");
    }
  };

  if (active.error) return <LoadError message={active.error} onRetry={active.reload} />;
  if (!active.data) return <Loading />;
  const since = active.data[0]?.created_at;

  return (
    <section aria-label="Mój kalendarz" className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-lg font-bold text-brand-900">Mój kalendarz</h2>
      <p className="text-sm text-slate-600">
        Wydarzenia i dni wolne przedszkola w Twoim kalendarzu Google, Apple lub Outlook. Link jest prywatny – nie udostępniaj go.
      </p>
      {!apiUrl && (
        <p role="alert" className="text-sm text-red-700">
          Brak adresu serwera (VITE_API_URL) – subskrypcja kalendarza jest niedostępna.
        </p>
      )}

      {links ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <a href={links.google} target="_blank" rel="noreferrer" className={linkClass}>
              Google
            </a>
            <a href={links.webcal} className={linkClass}>
              Apple
            </a>
            <a href={links.outlook} target="_blank" rel="noreferrer" className={linkClass}>
              Outlook
            </a>
            <button type="button" onClick={() => void copy()} className={linkClass}>
              Kopiuj
            </button>
          </div>
          <input
            readOnly
            aria-label="Link do kalendarza"
            value={links.https}
            onFocus={(e) => e.target.select()}
            className="w-full rounded-lg border border-slate-300 px-2 py-1 font-mono text-xs"
          />
          <p className="text-xs text-slate-500">
            Link widzisz tylko teraz. Kalendarz Google odświeża subskrypcje nawet raz na dobę – pilne zmiany przyjdą jako
            powiadomienie.
          </p>
        </div>
      ) : (
        since && (
          <p className="text-sm text-slate-600">
            Masz aktywny link z {shortDate(warsawDay(since))}. Ze względów bezpieczeństwa link pokazujemy tylko raz – nowy link
            unieważni poprzedni.
          </p>
        )
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !apiUrl}
          onClick={() => void generate()}
          className="rounded-lg bg-brand-700 px-4 py-2 font-semibold text-white disabled:opacity-50"
        >
          {since ? "Wygeneruj nowy link" : "Dodaj do mojego kalendarza"}
        </button>
        {since && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void revoke()}
            className="rounded-lg border border-red-300 px-4 py-2 text-red-700"
          >
            Unieważnij link
          </button>
        )}
      </div>
      {message && (
        <p role="status" className="text-sm text-slate-700">
          {message}
        </p>
      )}
    </section>
  );
}

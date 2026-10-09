import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { readPublicEnv } from "../../lib/env";
import {
  callApi,
  currentSubscription,
  DEFAULT_PUSH_SETTINGS,
  disablePush,
  enablePush,
  pushSupport,
  type PushSettings,
} from "../../lib/push";

function IosInstructions() {
  return (
    <div role="note" aria-label="Instrukcja dla iPhone'a" className="space-y-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
      <p className="font-semibold">Na iPhonie powiadomienia działają tylko z aplikacji na ekranie początkowym.</p>
      <ol className="list-decimal space-y-1 pl-5">
        <li>
          Stuknij <strong>Udostępnij</strong> (kwadrat ze strzałką) na dole Safari.
        </li>
        <li>
          Wybierz <strong>Do ekranu początkowego</strong> i potwierdź.
        </li>
        <li>Otwórz Czyżyka z nowej ikony i włącz powiadomienia tutaj.</li>
      </ol>
    </div>
  );
}

export function PushSettingsSection() {
  const { client } = useAuth();
  const { apiUrl, vapidPublicKey } = readPublicEnv();
  const support = pushSupport();
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [settings, setSettings] = useState<PushSettings>(DEFAULT_PUSH_SETTINGS);
  const [showIos, setShowIos] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    // A late answer must not undo enabling/disabling the user already did (prev is then set).
    void currentSubscription().then(
      (s) => alive && setSubscribed((prev) => prev ?? s != null),
      () => alive && setSubscribed((prev) => prev ?? false),
    );
    void client
      .from("push_settings")
      .select("digest_enabled, digest_time, alert_closures, alert_actions, alert_payments, morning_enabled, morning_time, reminders_enabled")
      .maybeSingle()
      .then(({ data }) => {
        if (alive && data) {
          const row = data as PushSettings;
          setSettings({
            ...DEFAULT_PUSH_SETTINGS,
            ...row,
            digest_time: row.digest_time.slice(0, 5),
            morning_time: (row.morning_time ?? DEFAULT_PUSH_SETTINGS.morning_time).slice(0, 5),
          });
        }
      });
    return () => {
      alive = false;
    };
  }, [client]);

  const configured = apiUrl != null && vapidPublicKey != null;

  const enable = async () => {
    setMessage(null);
    if (support === "ios-needs-install") return setShowIos(true);
    if (!configured) return;
    setBusy(true);
    try {
      await enablePush(client, apiUrl, vapidPublicKey);
      setSubscribed(true);
      setMessage("Powiadomienia włączone na tym urządzeniu.");
    } catch (error) {
      setMessage(
        (error as Error).message === "permission"
          ? "Przeglądarka nie zezwoliła na powiadomienia. Zmień to w ustawieniach witryny."
          : "Nie udało się włączyć powiadomień.",
      );
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    if (!apiUrl) return;
    setBusy(true);
    try {
      await disablePush(client, apiUrl);
      setSubscribed(false);
      setMessage("Powiadomienia wyłączone na tym urządzeniu.");
    } catch {
      setMessage("Nie udało się wyłączyć powiadomień.");
    } finally {
      setBusy(false);
    }
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!apiUrl) return;
    setBusy(true);
    try {
      setSettings((await callApi(client, apiUrl, "/push/settings", "PUT", settings)) as PushSettings);
      setMessage("Zapisano ustawienia powiadomień.");
    } catch {
      setMessage("Nie udało się zapisać ustawień.");
    } finally {
      setBusy(false);
    }
  };

  const toggle = (name: keyof PushSettings) => (e: { target: { checked: boolean } }) =>
    setSettings((s) => ({ ...s, [name]: e.target.checked }));

  return (
    <section id="powiadomienia" aria-label="Powiadomienia" className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="font-display text-3xl font-bold text-ink">Powiadomienia</h2>
      <p className="text-sm text-slate-600">
        Wieczorny skrót na jutro i natychmiastowe alerty: dzień wolny, nowa sprawa do załatwienia, płatność na jutro.
      </p>

      {support === "unsupported" && <p className="text-sm text-slate-600">Ta przeglądarka nie obsługuje powiadomień push.</p>}
      {support !== "unsupported" && !configured && (
        <p role="alert" className="text-sm text-red-700">
          Brak konfiguracji powiadomień (VITE_API_URL, VITE_VAPID_PUBLIC_KEY).
        </p>
      )}

      {support !== "unsupported" &&
        (subscribed ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-brand-700">Włączone na tym urządzeniu</span>
            <button type="button" disabled={busy} onClick={() => void disable()} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              Wyłącz na tym urządzeniu
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={busy || (support === "supported" && !configured)}
            onClick={() => void enable()}
            className="rounded-lg bg-brand-700 px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            Włącz powiadomienia
          </button>
        ))}
      {showIos && <IosInstructions />}

      {subscribed && (
        <form onSubmit={save} aria-label="Ustawienia powiadomień" className="space-y-2 border-t border-slate-100 pt-3 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={settings.morning_enabled} onChange={toggle("morning_enabled")} />
            Poranny skrót na dziś
          </label>
          <label className="flex items-center gap-2 pl-6">
            Godzina rano
            <input
              type="time"
              step={60}
              required
              value={settings.morning_time}
              disabled={!settings.morning_enabled && !settings.reminders_enabled}
              onChange={(e) => setSettings((s) => ({ ...s, morning_time: e.target.value }))}
              className="rounded-lg border border-slate-300 px-2 py-1"
            />
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={settings.reminders_enabled} onChange={toggle("reminders_enabled")} />
            Przypomnienia o terminach płatności i odpowiedzi (dzień przed i w dniu terminu, rano)
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={settings.digest_enabled} onChange={toggle("digest_enabled")} />
            Wieczorny skrót na jutro
          </label>
          <label className="flex items-center gap-2 pl-6">
            Godzina
            <input
              type="time"
              step={60}
              required
              value={settings.digest_time}
              disabled={!settings.digest_enabled}
              onChange={(e) => setSettings((s) => ({ ...s, digest_time: e.target.value }))}
              className="rounded-lg border border-slate-300 px-2 py-1"
            />
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={settings.alert_closures} onChange={toggle("alert_closures")} />
            Alert: dzień wolny
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={settings.alert_actions} onChange={toggle("alert_actions")} />
            Alert: sprawa „wymaga odpowiedzi”
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={settings.alert_payments} onChange={toggle("alert_payments")} />
            Alert: płatność na jutro
          </label>
          <button type="submit" disabled={busy} className="rounded-lg bg-brand-700 px-4 py-2 font-semibold text-white disabled:opacity-50">
            Zapisz
          </button>
        </form>
      )}
      {message && (
        <p role="status" className="text-sm text-slate-700">
          {message}
        </p>
      )}
    </section>
  );
}

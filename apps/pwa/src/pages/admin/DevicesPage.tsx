import QRCode from "qrcode";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { LoadError, Loading } from "../../components/ui";
import { readPublicEnv } from "../../lib/env";
import { relativeTime } from "../../lib/relativeTime";
import { useLoader } from "../../lib/useLoader";

interface Device {
  id: string;
  name: string;
  created_at: string;
  last_seen_at: string | null;
  revoked_at: string | null;
}

/** `app` is the PWA's own address: the Android app opens it as its main view. */
export function pairingLink(apiUrl: string, token: string, appUrl?: string): string {
  const app = appUrl ? `&app=${encodeURIComponent(appUrl)}` : "";
  return `czyzyk://pair?server=${encodeURIComponent(apiUrl)}&token=${token}${app}`;
}

/** Shows a freshly created token exactly once; closing the dialog forgets it. */
function TokenDialog({ name, token, onClose }: { name: string; token: string; onClose: () => void }) {
  const apiUrl = readPublicEnv().apiUrl;
  const link = apiUrl ? pairingLink(apiUrl, token, window.location.origin) : null;
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    if (link) void QRCode.toDataURL(link, { margin: 1, width: 240 }).then(setQr);
  }, [link]);

  return (
    <div role="dialog" aria-modal="true" aria-label={`Parowanie: ${name}`} className="fixed inset-0 z-10 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5">
        <h2 className="font-display text-3xl font-bold text-ink">Sparuj „{name}”</h2>
        <p className="text-sm text-slate-600">
          Zeskanuj kod w aplikacji Czyżyk Connect na telefonie albo otwórz link na telefonie. Token zobaczysz tylko teraz.
        </p>
        {qr && <img src={qr} alt="Kod QR parowania" className="mx-auto h-60 w-60" />}
        {link ? (
          <a href={link} className="block rounded-lg bg-brand-700 px-4 py-3 text-center font-semibold text-white">
            Otwórz w aplikacji na tym telefonie
          </a>
        ) : (
          <p role="alert" className="text-sm text-red-700">
            Brak VITE_API_URL – link parowania nie zawiera adresu serwera. Wpisz go ręcznie w aplikacji.
          </p>
        )}
        <label className="block text-sm">
          Token
          <input readOnly value={token} onFocus={(e) => e.target.select()} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 font-mono text-xs" />
        </label>
        <button type="button" onClick={onClose} className="w-full rounded-lg border border-slate-300 py-2 font-medium">
          Zamknij
        </button>
      </div>
    </div>
  );
}

export function DevicesPage() {
  const { client } = useAuth();
  const { data, error, loading, reload } = useLoader(async () => {
    const { data, error } = await client
      .from("devices")
      .select("id, name, created_at, last_seen_at, revoked_at")
      .order("created_at", { ascending: false })
      .returns<Device[]>();
    if (error) throw new Error(error.message);
    return data ?? [];
  }, [client]);
  const [name, setName] = useState("");
  const [created, setCreated] = useState<{ name: string; token: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    setActionError(null);
    const { data: rows, error: err } = await client.rpc("admin_create_device", { p_name: name });
    const row = (rows as { name: string; token: string }[] | null)?.[0];
    if (err || !row) return setActionError(err?.message ?? "Nie udało się dodać urządzenia.");
    setCreated({ name: row.name, token: row.token });
    setName("");
    reload();
  };

  const onRevoke = async (d: Device) => {
    if (!window.confirm(`Odłączyć „${d.name}”? Telefon przestanie wysyłać dane do czasu ponownego sparowania.`)) return;
    const { error: err } = await client.rpc("admin_revoke_device", { p_id: d.id });
    if (err) setActionError(err.message);
    reload();
  };

  return (
    <section className="space-y-4">
      <h1 className="font-display text-4xl font-bold text-ink">Urządzenia</h1>
      <p className="text-sm text-slate-600">Telefon z aplikacją Czyżyk, który wysyła wiadomości z grup przedszkola.</p>
      {actionError && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {actionError}
        </p>
      )}
      <form onSubmit={(e) => void onCreate(e)} className="flex gap-2 rounded-2xl bg-white p-4 shadow-sm">
        <label className="sr-only" htmlFor="device-name">
          Nazwa urządzenia
        </label>
        <input
          id="device-name"
          required
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Telefon Darka"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2"
        />
        <button type="submit" className="rounded-lg bg-brand-700 px-4 py-2 font-semibold text-white">
          Dodaj telefon
        </button>
      </form>
      {error && <LoadError message={error} onRetry={reload} />}
      {!data && loading && <Loading />}
      {data && (
        <ul className="divide-y divide-slate-100 rounded-2xl bg-white shadow-sm">
          {data.length === 0 && <li className="p-4 text-slate-500">Brak sparowanych urządzeń</li>}
          {data.map((d) => (
            <li key={d.id} className="flex items-center gap-2 p-4">
              <div className="min-w-0 flex-1">
                <p className={`font-medium ${d.revoked_at ? "text-slate-400 line-through" : ""}`}>{d.name}</p>
                <p className="text-sm text-slate-500">
                  {d.revoked_at ? "odłączone" : `ostatni kontakt: ${relativeTime(d.last_seen_at)}`}
                </p>
              </div>
              {!d.revoked_at && (
                <button type="button" onClick={() => void onRevoke(d)} className="rounded-lg px-2 py-1 text-sm text-red-700 hover:bg-red-50">
                  Odłącz
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {created && <TokenDialog name={created.name} token={created.token} onClose={() => setCreated(null)} />}
    </section>
  );
}

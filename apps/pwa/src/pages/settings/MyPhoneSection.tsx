import { phoneKey } from "@czyzyk/shared/contacts";
import { useState, type FormEvent } from "react";
import { useAuth, useProfile } from "../../auth/AuthProvider";
import { LoadError, Loading } from "../../components/ui";
import { fetchContactRoles, setMyPhone } from "../../lib/contacts";
import { useLoader } from "../../lib/useLoader";

/** The member's own WhatsApp number: their messages are marked "nasza rodzina" (contact-roles). */
export function MyPhoneSection() {
  const { client } = useAuth();
  const me = useProfile().id;
  const { data, error, reload } = useLoader(
    async () => (await fetchContactRoles(client)).find((r) => r.profile_id === me)?.author_key ?? null,
    [client, me],
  );

  return (
    <section aria-label="Mój numer WhatsApp" className="space-y-3 rounded-[28px] bg-card p-5 shadow-sm">
      <h2 className="font-display text-3xl font-bold text-ink">Mój numer WhatsApp</h2>
      <p className="text-sm text-muted">
        Twoje wiadomości w grupach będą oznaczone jako „nasza rodzina”, a wiadomości z wzmianką o Tobie (@numer) – jako skierowane do rodziny.
        Asystent nie zrobi z Twoich własnych wiadomości zadań dla Ciebie.
      </p>
      {error ? <LoadError message={error} onRetry={reload} /> : data === undefined ? <Loading /> : <PhoneForm key={data ?? ""} saved={data} onSaved={reload} />}
    </section>
  );
}

function PhoneForm({ saved, onSaved }: { saved: string | null; onSaved: () => void }) {
  const { client } = useAuth();
  const [draft, setDraft] = useState(saved ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const key = draft.trim() ? phoneKey(draft) : null;
  const invalid = draft.trim() !== "" && key == null;

  const store = async (value: string | null) => {
    setBusy(true);
    setMessage(null);
    try {
      await setMyPhone(client, value);
      onSaved();
    } catch {
      setMessage("Nie udało się zapisać.");
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (key) void store(key);
  };

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          inputMode="tel"
          placeholder="np. +48 535 111 213"
          aria-label="Numer telefonu"
          className="min-w-0 flex-1 rounded-full border border-sand-400 bg-white px-4 py-2"
        />
        <button
          type="submit"
          disabled={busy || !key || key === saved}
          className="rounded-full bg-brand-700 px-4 py-2 font-semibold text-white disabled:opacity-45"
        >
          Zapisz
        </button>
        {saved && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void store(null)}
            className="rounded-full px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
          >
            Usuń
          </button>
        )}
      </div>
      {invalid && <p className="text-sm text-red-700">Wpisz numer telefonu, np. +48 535 111 213 albo 535 111 213.</p>}
      {saved && !message && <p className="text-sm text-muted">Zapisany numer: {saved}</p>}
      {message && (
        <p role="alert" className="text-sm text-red-700">
          {message}
        </p>
      )}
    </form>
  );
}

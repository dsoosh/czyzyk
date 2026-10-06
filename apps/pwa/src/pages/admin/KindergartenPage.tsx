import { useState, type FormEvent } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { LoadError, Loading } from "../../components/ui";
import { run } from "../../lib/items";
import { useLoader } from "../../lib/useLoader";

export const PROFILE_MAX = 8000;

/** Description of the kindergarten: background the extraction and the assistant read. */
export function KindergartenPage() {
  const { client } = useAuth();
  const { data, error, reload } = useLoader(
    () => run<{ content: string; updated_at: string }[]>(client.from("kindergarten_profile").select("content, updated_at")),
    [client],
  );
  // Lives here, not in the form: the form remounts after a save.
  const [message, setMessage] = useState<string | null>(null);
  if (error) return <LoadError message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const saved = data[0]?.content ?? "";
  // Keyed by the stored text: the form starts from it and restarts after a save.
  return <ProfileForm key={saved} saved={saved} onSaved={reload} message={message} setMessage={setMessage} />;
}

function ProfileForm({
  saved,
  onSaved,
  message,
  setMessage,
}: {
  saved: string;
  onSaved: () => void;
  message: string | null;
  setMessage: (m: string | null) => void;
}) {
  const { client } = useAuth();
  const [draft, setDraft] = useState(saved);
  const [busy, setBusy] = useState(false);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const { error: rpcError } = await client.rpc("admin_update_kindergarten_profile", { p_content: draft });
    setBusy(false);
    setMessage(rpcError ? "Nie udało się zapisać." : "Zapisano. Kolejne analizy wiadomości i odpowiedzi asystenta uwzględnią opis.");
    if (!rpcError) onSaved();
  };

  return (
    <form onSubmit={save} className="space-y-3">
      <h1 className="font-display text-4xl font-bold text-ink">Przedszkole</h1>
      <p className="text-sm text-muted">
        Opis placówki: miejsca, prowadzący, grupy i kanały. Model analizujący wiadomości i asystent „Zapytaj” czytają go jako tło – np. żeby wiedzieć, że „Baza” to Golędzinów.
      </p>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        maxLength={PROFILE_MAX}
        rows={18}
        aria-label="Opis przedszkola"
        className="w-full rounded-[20px] border border-sand-400 bg-white p-4 text-sm leading-relaxed"
      />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy || draft.trim() === saved.trim()}
          className="rounded-full bg-ink px-5 py-2 font-semibold text-cream disabled:opacity-45"
        >
          Zapisz
        </button>
        <span className="text-xs text-muted">
          {draft.length} / {PROFILE_MAX}
        </span>
      </div>
      {message && (
        <p role="status" className="text-sm text-ink">
          {message}
        </p>
      )}
    </form>
  );
}

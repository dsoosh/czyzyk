import { useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { run } from "../lib/items";
import { useLoader } from "../lib/useLoader";

interface Invite {
  id: string;
  family_name: string;
  invited_by_name: string | null;
}

/** Invites to another family (families-joining): joining moves the member, with their data when alone. */
export function FamilyInvites({ onJoined }: { onJoined: () => void }) {
  const { client } = useAuth();
  const { data, reload } = useLoader(async () => (await run<Invite[] | null>(client.rpc("my_family_invites"))) ?? [], [client]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const answer = async (fn: "accept_family_invite" | "decline_family_invite", id: string) => {
    setBusy(true);
    setMessage(null);
    const { error } = await client.rpc(fn, { p_id: id });
    setBusy(false);
    if (error) setMessage(error.message);
    reload();
    if (!error && fn === "accept_family_invite") onJoined();
  };

  if (!data || data.length === 0) return null;
  return (
    <>
      {data.map((inv) => (
        <section key={inv.id} aria-label="Zaproszenie do rodziny" className="space-y-2 rounded-[28px] bg-sun/35 px-5 py-4 text-ink">
          <h2 className="font-display text-2xl font-bold">Zaproszenie do rodziny</h2>
          <p className="text-sm">
            {inv.invited_by_name ?? "Ktoś"} zaprasza Cię do rodziny „{inv.family_name}”. Po dołączeniu zobaczysz jej dzieci i sprawy. Jeśli w obecnej
            rodzinie jesteś sam(a), Twoje dzieci i odhaczone sprawy przejdą razem z Tobą.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void answer("accept_family_invite", inv.id)}
              className="rounded-full bg-ink px-5 py-2 font-semibold text-cream disabled:opacity-50"
            >
              Dołącz
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void answer("decline_family_invite", inv.id)}
              className="rounded-full px-4 py-2 font-semibold text-ink underline disabled:opacity-50"
            >
              Odrzuć
            </button>
          </div>
        </section>
      ))}
      {message && (
        <p role="alert" className="text-sm text-red-700">
          {message}
        </p>
      )}
    </>
  );
}

import { useAuth } from "../auth/AuthProvider";
import { Logo } from "../components/Logo";

/** Signed in, but the access request still waits for the operator or was rejected (families-joining). */
export function WaitingPage({ email, rejected }: { email: string; rejected: boolean }) {
  const { refreshProfile, signOut, signInWithGoogle } = useAuth();
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
      <Logo className="h-16 w-16 opacity-60" />
      <h1 className="font-display text-4xl font-bold text-ink">{rejected ? "Prośba odrzucona" : "Czekasz na akceptację"}</h1>
      {rejected ? (
        <p className="text-slate-700">Administrator nie przyznał dostępu {email ? `kontu ${email}` : "temu kontu"}.</p>
      ) : (
        <>
          <p className="text-slate-700">
            Prośba o dostęp {email ? `dla ${email} ` : ""}trafiła do administratora. Gdy ją zaakceptuje, Czyżyk otworzy się po powrocie do aplikacji.
          </p>
          <p className="text-sm text-slate-500">Jeśli ktoś z Twojej rodziny już korzysta z Czyżyka, może dodać Twój adres w ustawieniach, w sekcji „Moja rodzina”.</p>
          <button
            type="button"
            onClick={() => void refreshProfile()}
            className="w-full rounded-xl bg-brand-700 px-4 py-3 font-semibold text-white shadow hover:bg-brand-600"
          >
            Sprawdź ponownie
          </button>
        </>
      )}
      {rejected ? (
        <button
          type="button"
          onClick={() => void signInWithGoogle({ selectAccount: true })}
          className="w-full rounded-xl border border-brand-700 px-4 py-3 font-semibold text-brand-700 hover:bg-brand-100"
        >
          Zaloguj innym kontem Google
        </button>
      ) : (
        <button type="button" onClick={() => void signOut()} className="text-sm text-slate-600 underline">
          Wyloguj
        </button>
      )}
    </main>
  );
}

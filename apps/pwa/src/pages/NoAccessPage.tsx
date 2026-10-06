import { useAuth } from "../auth/AuthProvider";
import { Logo } from "../components/Logo";

export function NoAccessPage({ message }: { message: string }) {
  const { signInWithGoogle } = useAuth();
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
      <Logo className="h-16 w-16 opacity-60" />
      <h1 className="font-display text-4xl font-bold text-ink">Brak dostępu</h1>
      <p role="alert" className="text-slate-700">
        {message}
      </p>
      <p className="text-sm text-slate-500">Jeśli należysz do rodziny, poproś administratora o dodanie Twojego adresu.</p>
      <button
        type="button"
        onClick={() => void signInWithGoogle({ selectAccount: true })}
        className="w-full rounded-xl border border-brand-700 px-4 py-3 font-semibold text-brand-700 hover:bg-brand-100"
      >
        Zaloguj innym kontem Google
      </button>
    </main>
  );
}

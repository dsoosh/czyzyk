import { useAuth } from "../auth/AuthProvider";

export function LoginPage() {
  const { signInWithGoogle } = useAuth();
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
      <div>
        <h1>
          <img src="/logo.svg" alt="Czyżyk" className="mx-auto h-auto w-64" />
        </h1>
        <p className="mt-2 text-slate-600">Asystent przedszkolny rodziny</p>
      </div>
      <button
        type="button"
        onClick={() => void signInWithGoogle()}
        className="w-full rounded-xl bg-brand-700 px-4 py-3 font-semibold text-white shadow hover:bg-brand-600"
      >
        Zaloguj przez Google
      </button>
      <p className="text-sm text-slate-500">Dostęp mają tylko osoby z listy rodziny.</p>
    </main>
  );
}

import { useProfile } from "../auth/AuthProvider";

export function HomePage() {
  const profile = useProfile();
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold text-brand-900">Dziś i jutro</h1>
      <p className="text-slate-600">Cześć, {profile.display_name ?? profile.email}!</p>
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <p className="text-slate-700">
          Tu pojawią się wydarzenia, rzeczy do przyniesienia i płatności z grup przedszkola.
        </p>
      </div>
    </section>
  );
}

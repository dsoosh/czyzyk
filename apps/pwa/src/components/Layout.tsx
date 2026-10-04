import { NavLink, Outlet } from "react-router";
import { useAuth, useProfile } from "../auth/AuthProvider";
import { Logo } from "./Logo";

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `flex flex-1 flex-col items-center py-3 text-sm font-medium ${isActive ? "text-brand-700" : "text-slate-500"}`;

export function Layout() {
  const profile = useProfile();
  const { signOut } = useAuth();
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col">
      <header className="flex items-center gap-3 px-4 py-3">
        <Logo className="h-8 w-8" />
        <span className="flex-1 text-lg font-bold text-brand-900">Czyżyk</span>
        <button type="button" onClick={() => void signOut()} className="text-sm text-slate-600 hover:underline">
          Wyloguj
        </button>
      </header>
      <main className="flex-1 px-4 pb-24">
        <Outlet />
      </main>
      <nav
        aria-label="Nawigacja"
        className="fixed inset-x-0 bottom-0 mx-auto flex max-w-lg border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]"
      >
        <NavLink to="/" end className={tabClass}>
          Dziś
        </NavLink>
        {profile.role === "admin" && (
          <NavLink to="/admin" className={tabClass}>
            Admin
          </NavLink>
        )}
      </nav>
    </div>
  );
}

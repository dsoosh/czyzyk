import { NavLink, Outlet, useOutletContext } from "react-router";
import { useAuth, useProfile } from "../auth/AuthProvider";
import { fetchReviewCount } from "../lib/review";
import { useLoader, useOnForeground } from "../lib/useLoader";
import { Logo } from "./Logo";

export interface LayoutContext {
  /** Re-reads the review queue size shown on the Admin tab. */
  refreshReviewCount: () => void;
}

export const useLayoutContext = () => useOutletContext<LayoutContext>();

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `flex flex-1 flex-col items-center py-3 text-sm font-medium ${isActive ? "text-brand-700" : "text-slate-500"}`;

export function Layout() {
  const profile = useProfile();
  const { signOut, client } = useAuth();
  const isAdmin = profile.role === "admin";
  const reviewCount = useLoader(async () => (isAdmin ? fetchReviewCount(client) : 0), [client, isAdmin]);
  useOnForeground(reviewCount.reload);
  const pending = reviewCount.data ?? 0;
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
        <Outlet context={{ refreshReviewCount: reviewCount.reload } satisfies LayoutContext} />
      </main>
      <nav
        aria-label="Nawigacja"
        className="fixed inset-x-0 bottom-0 mx-auto flex max-w-lg border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]"
      >
        <NavLink to="/" end className={tabClass}>
          Dziś
        </NavLink>
        <NavLink to="/listy" className={tabClass}>
          Listy
        </NavLink>
        <NavLink to="/kalendarz" className={tabClass}>
          Kalendarz
        </NavLink>
        {isAdmin && (
          <NavLink to="/admin" className={tabClass}>
            <span className="relative">
              Admin
              {pending > 0 && (
                <span
                  aria-label={`${pending} do przejrzenia`}
                  className="absolute -top-2 -right-5 min-w-5 rounded-full bg-red-600 px-1 text-center text-xs leading-5 text-white"
                >
                  {pending}
                </span>
              )}
            </span>
          </NavLink>
        )}
      </nav>
    </div>
  );
}

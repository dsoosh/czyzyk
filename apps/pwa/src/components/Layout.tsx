import { Link, NavLink, Outlet, useOutletContext } from "react-router";
import { useAuth, useProfile } from "../auth/AuthProvider";
import { fetchReviewCount } from "../lib/review";
import { useLoader, useOnForeground } from "../lib/useLoader";
import { useMediaQuery, WIDE_SCREEN } from "../lib/useMediaQuery";
import { AssistantPanel } from "./AssistantPanel";
import { Logo } from "./Logo";

export interface LayoutContext {
  /** Re-reads the review queue size shown on the Admin tab. */
  refreshReviewCount: () => void;
}

export const useLayoutContext = () => useOutletContext<LayoutContext>();

/** Lucide paths (stroke-width 2.75). */
const ICONS = {
  today: ["M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z", "M12 2v2", "M12 20v2", "m4.93 4.93 1.41 1.41", "m17.66 17.66 1.41 1.41", "M2 12h2", "M20 12h2", "m6.34 17.66-1.41 1.41", "m19.07 4.93-1.41 1.41"],
  lists: ["m3 17 2 2 4-4", "m3 7 2 2 4-4", "M13 6h8", "M13 12h8", "M13 18h8"],
  calendar: ["M8 2v4", "M16 2v4", "M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z", "M3 10h18"],
  chats: ["M7.9 20A9 9 0 1 0 4 16.1L2 22Z"],
  admin: ["M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"],
  settings: ["M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z", "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"],
  logout: ["m16 17 5-5-5-5", "M21 12H9", "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"],
} satisfies Record<string, string[]>;

function Icon({ name, className = "h-5 w-5" }: { name: keyof typeof ICONS; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.75} strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

interface Tab {
  to: string;
  label: string;
  icon: keyof typeof ICONS;
  end?: boolean;
}

const TABS: Tab[] = [
  { to: "/", label: "Dziś", icon: "today", end: true },
  { to: "/listy", label: "Listy", icon: "lists" },
  { to: "/kalendarz", label: "Kalendarz", icon: "calendar" },
  { to: "/czaty", label: "Czaty", icon: "chats" },
];
const ADMIN_TAB: Tab = { to: "/admin", label: "Admin", icon: "admin" };

/** Phone: equal-width icon-over-label tabs in the floating bottom bar. */
const tabClass = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-bold transition-colors ${
    isActive ? "bg-lime text-ink" : "text-sand hover:bg-white/10 active:bg-white/20"
  }`;

/** Desktop: full-width rows in the sidebar. */
const sideTabClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-full px-4 py-3 text-[15px] font-bold transition-colors ${
    isActive ? "bg-lime text-ink" : "text-sand hover:bg-white/10 active:bg-white/20"
  }`;

const roundButton =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink transition-colors hover:bg-ink/5 active:bg-ink/10";

function ReviewBadge({ pending }: { pending: number }) {
  if (pending <= 0) return null;
  return (
    <span
      aria-label={`${pending} do przejrzenia`}
      className="absolute -top-2 -right-3 min-w-5 rounded-full bg-clay px-1 text-center text-xs leading-5 text-white"
    >
      {pending}
    </span>
  );
}

function Brand() {
  return (
    <>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm">
        <Logo className="h-8 w-9" />
      </span>
      <span className="ml-1 flex-1 font-display text-[32px] leading-none font-bold text-ink">Czyżyk</span>
    </>
  );
}

export function Layout() {
  const profile = useProfile();
  const { signOut, client } = useAuth();
  const isAdmin = profile.role === "admin";
  const reviewCount = useLoader(async () => (isAdmin ? fetchReviewCount(client) : 0), [client, isAdmin]);
  useOnForeground(reviewCount.reload);
  const pending = reviewCount.data ?? 0;
  const wide = useMediaQuery(WIDE_SCREEN);
  const tabs = isAdmin ? [...TABS, ADMIN_TAB] : TABS;
  const outlet = <Outlet context={{ refreshReviewCount: reviewCount.reload } satisfies LayoutContext} />;
  const accountButtons = (
    <>
      <button type="button" onClick={() => void signOut()} aria-label="Wyloguj" title="Wyloguj" className={roundButton}>
        <Icon name="logout" />
      </button>
      <Link to="/ustawienia" aria-label="Ustawienia" title="Ustawienia" className={`${roundButton} border border-ink/15`}>
        <Icon name="settings" />
      </Link>
    </>
  );

  // Only one navigation is rendered, so assistive tech (and tests) never see the tabs twice.
  if (wide) {
    return (
      <div className="mx-auto flex min-h-screen max-w-6xl gap-10 px-8">
        <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col gap-6 py-8">
          <div className="flex items-center gap-2">
            <Brand />
          </div>
          <nav aria-label="Nawigacja" className="flex flex-col gap-1 rounded-[28px] bg-ink p-2 shadow-lg">
            {tabs.map((t) => (
              <NavLink key={t.to} to={t.to} end={t.end} className={sideTabClass}>
                <span className="relative">
                  <Icon name={t.icon} />
                  {t === ADMIN_TAB && <ReviewBadge pending={pending} />}
                </span>
                {t.label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-auto flex gap-2">{accountButtons}</div>
        </aside>
        <main className="min-w-0 flex-1 py-10">{outlet}</main>
        <AssistantPanel />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col">
      <header className="flex items-center gap-2 px-5 pt-5 pb-3">
        <Brand />
        {accountButtons}
      </header>
      <main className="flex-1 px-5 pb-32">{outlet}</main>
      <AssistantPanel />
      <nav
        aria-label="Nawigacja"
        className="fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] mx-auto flex max-w-[calc(32rem-2rem)] gap-1 rounded-full bg-ink p-1.5 shadow-lg"
      >
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className={tabClass}>
            <span className="relative">
              <Icon name={t.icon} />
              {t === ADMIN_TAB && <ReviewBadge pending={pending} />}
            </span>
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

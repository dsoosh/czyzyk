import type { ReactNode } from "react";
import { Link } from "react-router";
import { CHILD_COLORS, childColor, type Child } from "../lib/children";
import type { ItemKind } from "../lib/items";

export function SourceLink({ kind, id }: { kind: ItemKind; id: string }) {
  return (
    <Link to={`/zrodlo/${kind}/${id}`} className="text-xs text-clay-700 underline underline-offset-2 hover:text-ink">
      skąd to wiem
    </Link>
  );
}

/** Logo band colours, used as a section marker. */
export type Stripe = "earth" | "sun" | "water" | "air";
const STRIPE_CLASS: Record<Stripe, string> = { earth: "bg-earth", sun: "bg-sun", water: "bg-water", air: "bg-air" };

export function Section({
  title,
  empty,
  stripe,
  children,
}: {
  title: string;
  empty: string;
  stripe?: Stripe;
  children: ReactNode[];
}) {
  return (
    <section aria-label={title} className="space-y-2.5">
      <div className="flex items-center gap-2.5">
        {stripe && <span aria-hidden="true" className={`h-2.5 w-7 shrink-0 rounded-full ${STRIPE_CLASS[stripe]}`} />}
        <h2 className="flex-1 text-[13px] font-bold tracking-wider text-ink uppercase">{title}</h2>
        {children.length > 0 && <span className="text-[13px] font-bold text-muted">{children.length}</span>}
      </div>
      {children.length === 0 ? (
        <p className="rounded-[28px] border-[1.5px] border-dashed border-sand-400 px-5 py-4 text-muted">{empty}</p>
      ) : (
        <ul className="divide-y divide-ink/10 rounded-[28px] bg-card px-5 shadow-sm">{children}</ul>
      )}
    </section>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return <li className="flex min-h-11 flex-col gap-1 py-3.5">{children}</li>;
}

export function Meta({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">{children}</div>;
}

export function Loading() {
  return <p className="py-8 text-center text-muted">Wczytywanie…</p>;
}

export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-[28px] bg-red-50 p-4 text-red-800">
      {message}{" "}
      <button type="button" className="underline" onClick={onRetry}>
        Spróbuj ponownie
      </button>
    </div>
  );
}

/** A tappable checklist row: marks the item done (or undoes it) for the whole family. */
export function DoneToggle({
  checked,
  label,
  disabled,
  onToggle,
}: {
  checked: boolean;
  label: string;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
        checked ? "border-ink bg-ink text-cream" : "border-sand-400 bg-white hover:border-ink"
      } disabled:opacity-45`}
    >
      {checked && (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      )}
    </button>
  );
}

/** Names of the children an item concerns, as a small pill (nothing when none). */
/** One tag per child, each in the child's own colour (child-colors). */
export function ChildTag({ kids, all }: { kids: Child[]; all: Child[] }) {
  if (kids.length === 0) return null;
  return (
    <span aria-label={`Dziecko: ${kids.map((c) => c.name).join(", ")}`} className="inline-flex flex-wrap gap-1">
      {kids.map((c) => (
        <span
          key={c.id}
          data-color={childColor(all, c)}
          style={{ backgroundColor: CHILD_COLORS[childColor(all, c)].bg }}
          className="rounded-full px-2 py-0.5 text-xs font-semibold text-ink"
        >
          {c.name}
        </span>
      ))}
    </span>
  );
}

import type { ReactNode } from "react";
import { Link } from "react-router";
import type { ItemKind } from "../lib/items";

export function SourceLink({ kind, id }: { kind: ItemKind; id: string }) {
  return (
    <Link to={`/zrodlo/${kind}/${id}`} className="text-xs text-brand-600 underline underline-offset-2">
      skąd to wiem
    </Link>
  );
}

export function Section({ title, empty, children }: { title: string; empty: string; children: ReactNode[] }) {
  return (
    <section aria-label={title} className="space-y-2">
      <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase">{title}</h2>
      {children.length === 0 ? (
        <p className="rounded-2xl bg-white p-4 text-slate-500 shadow-sm">{empty}</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-2xl bg-white shadow-sm">{children}</ul>
      )}
    </section>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return <li className="flex flex-col gap-1 p-4">{children}</li>;
}

export function Meta({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">{children}</div>;
}

export function Loading() {
  return <p className="py-8 text-center text-slate-500">Wczytywanie…</p>;
}

export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-2xl bg-red-50 p-4 text-red-800">
      {message}{" "}
      <button type="button" className="underline" onClick={onRetry}>
        Spróbuj ponownie
      </button>
    </div>
  );
}

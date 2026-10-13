import { ACTION_KIND_LABELS } from "../lib/items";

/** "Zapisy" / "Ankieta" on an action (event-plan). */
export function KindTag({ kind }: { kind: keyof typeof ACTION_KIND_LABELS }) {
  return <span className="rounded-full bg-air/40 px-2 py-0.5 text-xs font-semibold text-ink">{ACTION_KIND_LABELS[kind]}</span>;
}

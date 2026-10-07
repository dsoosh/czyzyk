import { useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { appliedMessage, applySuggestion } from "../lib/actions";
import type { ActionRequired } from "../lib/items";

/**
 * One-tap actions proposed for an open "wymaga odpowiedzi" item, e.g. "Do przyniesienia"
 * (moves it to things to bring) or "Tak, zapisujemy" (records the answer).
 */
export function ActionSuggestions({ item, onApplied }: { item: ActionRequired; onApplied: (message: string) => void }) {
  const { client } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const suggestions = item.suggested_actions ?? [];
  if (item.resolved_at || suggestions.length === 0) return null;

  const apply = async (index: number) => {
    setBusy(true);
    setError(null);
    try {
      onApplied(appliedMessage(await applySuggestion(client, item.id, index)));
    } catch {
      setError("Nie udało się. Spróbuj ponownie.");
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <div role="group" aria-label={`Proponowane akcje: ${item.question}`} className="flex flex-wrap gap-2">
        {suggestions.map((s, i) => (
          <button
            key={`${s.kind}:${s.label}`}
            type="button"
            disabled={busy}
            onClick={() => void apply(i)}
            className={
              i === 0
                ? "rounded-full bg-brand-700 px-3 py-1 text-sm font-semibold text-white disabled:opacity-45"
                : "rounded-full border border-sand-400 bg-white px-3 py-1 text-sm font-semibold text-ink disabled:opacity-45"
            }
          >
            {s.label}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

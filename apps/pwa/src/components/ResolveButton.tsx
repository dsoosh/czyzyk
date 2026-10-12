/** "Wymaga odpowiedzi": one action only – the family marks the item as done (no suggested actions). */
export function ResolveButton({ question, disabled, onResolve }: { question: string; disabled: boolean; onResolve: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={`Oznacz jako wykonane: ${question}`}
      onClick={onResolve}
      className="self-start rounded-full bg-ink px-4 py-1.5 text-sm font-semibold text-cream disabled:opacity-45"
    >
      Oznacz jako wykonane
    </button>
  );
}

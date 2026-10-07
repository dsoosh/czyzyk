import {
  DEFAULT_PROMPTS,
  FIXED_PROMPT_PARTS,
  MAX_PROMPT_LENGTH,
  PROMPT_KEYS,
  PROMPT_PLACEHOLDERS,
  PROMPT_TITLES,
  unknownPlaceholders,
  type PromptKey,
} from "@czyzyk/shared/prompts";
import { useRef, useState, type FormEvent } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { LoadError, Loading } from "../../components/ui";
import { run } from "../../lib/items";
import { useLoader } from "../../lib/useLoader";

const DESCRIPTIONS: Record<PromptKey, string> = {
  extraction: "Instrukcje dla modelu, który czyta wiadomości z grup i tworzy wydarzenia, rzeczy do przyniesienia, płatności i inne sprawy.",
  assistant: "Instrukcje dla asystenta, który odpowiada na pytania w okienku „Zapytaj” na każdym ekranie.",
};

/** Admin-edited LLM prompt templates with placeholders for family data (llm-prompts). */
export function PromptsPage() {
  const { client } = useAuth();
  const { data, error, reload } = useLoader(
    () => run<{ key: PromptKey; template: string }[]>(client.from("llm_prompts").select("key, template")),
    [client],
  );
  // Live here, not in the forms: a form remounts after a save.
  const [messages, setMessages] = useState<Partial<Record<PromptKey, string>>>({});
  if (error) return <LoadError message={error} onRetry={reload} />;
  if (!data) return <Loading />;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-4xl font-bold text-ink">Prompty</h1>
        <p className="text-sm text-muted">
          Instrukcje dla modelu językowego. W tekście możesz użyć placeholderów w podwójnych nawiasach klamrowych – w ich miejsce trafiają dane
          rodziny. Zasady bezpieczeństwa i format odpowiedzi są dopisywane zawsze i nie da się ich wyłączyć.
        </p>
      </div>
      {PROMPT_KEYS.map((key) => {
        const saved = data.find((r) => r.key === key)?.template ?? null;
        return (
          <PromptForm
            key={`${key}:${saved ?? ""}`}
            promptKey={key}
            saved={saved}
            onSaved={reload}
            message={messages[key] ?? null}
            setMessage={(m) => setMessages((all) => ({ ...all, [key]: m ?? undefined }))}
          />
        );
      })}
    </div>
  );
}

function PromptForm({
  promptKey,
  saved,
  onSaved,
  message,
  setMessage,
}: {
  promptKey: PromptKey;
  saved: string | null;
  onSaved: () => void;
  message: string | null;
  setMessage: (m: string | null) => void;
}) {
  const { client } = useAuth();
  const current = saved ?? DEFAULT_PROMPTS[promptKey];
  const [draft, setDraft] = useState(current);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  const title = PROMPT_TITLES[promptKey];
  const unknown = unknownPlaceholders(promptKey, draft);

  const store = async (template: string | null, done: string) => {
    setBusy(true);
    setMessage(null);
    const { error } = await client.rpc("admin_save_llm_prompt", { p_key: promptKey, p_template: template });
    setBusy(false);
    setMessage(error ? `Nie udało się zapisać: ${error.message}` : done);
    if (!error) onSaved();
  };

  const save = (e: FormEvent) => {
    e.preventDefault();
    void store(draft, "Zapisano. Kolejne zapytania do modelu użyją nowego promptu.");
  };

  /** Inserts {{name}} at the cursor. */
  const insert = (name: string) => {
    const el = box.current;
    const token = `{{${name}}}`;
    const at = el?.selectionStart ?? draft.length;
    const end = el?.selectionEnd ?? at;
    setDraft(draft.slice(0, at) + token + draft.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at + token.length, at + token.length);
    });
  };

  return (
    <form onSubmit={save} aria-label={title} className="space-y-3 rounded-[28px] bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-3xl font-bold text-ink">{title}</h2>
        <span className="text-xs font-semibold text-muted">{saved ? "własny prompt" : "domyślny prompt"}</span>
      </div>
      <p className="text-sm text-muted">{DESCRIPTIONS[promptKey]}</p>

      <div className="space-y-1">
        <p className="text-sm font-semibold text-ink">Placeholdery</p>
        <ul className="space-y-1 text-sm">
          {PROMPT_PLACEHOLDERS[promptKey].map((p) => (
            <li key={p.name} className="flex flex-wrap items-baseline gap-2">
              <button
                type="button"
                onClick={() => insert(p.name)}
                aria-label={`Wstaw {{${p.name}}}`}
                className="rounded-full bg-sand px-2.5 py-0.5 font-mono text-xs text-ink hover:bg-sand-400/50"
              >
                {`{{${p.name}}}`}
              </button>
              <span className="text-muted">{p.description}</span>
            </li>
          ))}
        </ul>
      </div>

      <textarea
        ref={box}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        maxLength={MAX_PROMPT_LENGTH}
        rows={16}
        aria-label={`Prompt: ${title}`}
        className="w-full rounded-[20px] border border-sand-400 bg-white p-4 font-mono text-xs leading-relaxed"
      />
      {unknown.length > 0 && (
        <p role="alert" className="text-sm text-red-700">
          Nieznane placeholdery: {unknown.map((n) => `{{${n}}}`).join(", ")}. Dostępne są tylko te z listy powyżej.
        </p>
      )}

      <details className="text-sm">
        <summary className="cursor-pointer text-muted">Stała część (dopisywana zawsze na końcu)</summary>
        <pre className="mt-2 whitespace-pre-wrap rounded-[20px] bg-sand p-4 font-mono text-xs text-ink">{FIXED_PROMPT_PARTS[promptKey]}</pre>
      </details>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy || unknown.length > 0 || !draft.trim() || draft.trim() === current.trim()}
          className="rounded-full bg-ink px-5 py-2 font-semibold text-cream disabled:opacity-45"
        >
          Zapisz
        </button>
        <button
          type="button"
          disabled={busy || saved == null}
          onClick={() => void store(null, "Przywrócono domyślny prompt.")}
          className="rounded-full px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-45"
        >
          Przywróć domyślny
        </button>
        <span className="text-xs text-muted">
          {draft.length} / {MAX_PROMPT_LENGTH}
        </span>
      </div>
      {message && (
        <p role="status" className="text-sm text-ink">
          {message}
        </p>
      )}
    </form>
  );
}

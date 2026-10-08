import { Link, useSearchParams } from "react-router";
import { useAuth } from "../../auth/AuthProvider";
import { LoadError, Loading } from "../../components/ui";
import { shortDate, warsawDay, warsawTime } from "../../lib/dates";
import { fetchGroupNames, groupLabel, run } from "../../lib/items";
import { useLoader, useOnForeground } from "../../lib/useLoader";

const PAGE = 50;

interface LlmCall {
  id: string;
  kind: "extraction" | "document" | "triage";
  group_id: string | null;
  model: string | null;
  request: { system?: string; user?: string; images?: string[] };
  response: { operations?: unknown[]; containsPeople?: boolean; relevant?: boolean } | null;
  error: string | null;
  usage: { input_tokens?: number; output_tokens?: number } | null;
  duration_ms: number | null;
  created_at: string;
}

/** Admin's log of the extraction model's calls: what went to the model and what came back (llm-call-log). */
export function LlmCallsPage() {
  const { client } = useAuth();
  // ?wywolanie=<id>: one call, opened from a message in the chat (message-details).
  const [params] = useSearchParams();
  const only = params.get("wywolanie");
  const { data, error, reload } = useLoader(async () => {
    const columns = "id, kind, group_id, model, request, response, error, usage, duration_ms, created_at";
    const [calls, groups] = await Promise.all([
      run<LlmCall[]>(
        only
          ? client.from("llm_calls").select(columns).eq("id", only)
          : client.from("llm_calls").select(columns).order("created_at", { ascending: false }).limit(PAGE),
      ),
      fetchGroupNames(client),
    ]);
    return { calls, groups };
  }, [client, only]);
  useOnForeground(reload);
  if (error) return <LoadError message={error} onRetry={reload} />;
  if (!data) return <Loading />;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="font-display text-4xl font-bold text-ink">Wywołania LLM</h1>
        <p className="text-sm text-muted">
          Co trafiło do modelu przy analizie wiadomości i co odpowiedział. Ostatnie {PAGE} wywołań; wpisy starsze niż 14 dni są usuwane.
          Rozmowy z asystentem „Zapytaj” są prywatne i tu nie trafiają.
        </p>
      </div>
      {only && (
        <Link to="/admin/llm" className="text-sm text-brand-700 underline">
          ← Wszystkie wywołania
        </Link>
      )}
      {data.calls.length === 0 ? (
        <p className="text-slate-600">{only ? "Tego wywołania już nie ma (wpisy starsze niż 14 dni są usuwane)." : "Brak wywołań w ostatnich 14 dniach."}</p>
      ) : (
        <ul className="space-y-3">
          {data.calls.map((c) => (
            <li key={c.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <details open={only === c.id}>
                <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="font-semibold text-ink">
                    {shortDate(warsawDay(c.created_at))} {warsawTime(c.created_at)}
                  </span>
                  <span>{groupLabel(data.groups, c.group_id)}</span>
                  {c.kind !== "extraction" && <span className="text-xs text-slate-500">{KIND_LABELS[c.kind]}</span>}
                  {c.error ? (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">błąd</span>
                  ) : (
                    <span className="rounded-full bg-sand px-2 py-0.5 text-xs font-semibold text-ink">{resultLabel(c)}</span>
                  )}
                  <span className="text-xs text-slate-500">{usageLabel(c)}</span>
                </summary>
                <div className="mt-3 space-y-3 text-sm">
                  {c.model && <p className="text-xs text-slate-500">Model: {c.model}</p>}
                  {c.error && <p className="text-red-800">Błąd: {c.error}</p>}
                  {c.request.user ? <Block title="Zapytanie (wiadomości)" text={c.request.user} open /> : null}
                  {c.request.images?.length ? <p className="text-xs text-slate-600">Dołączone obrazy: {c.request.images.join(" · ")}</p> : null}
                  {c.response && <Block title="Odpowiedź modelu" text={JSON.stringify(c.response.operations ?? c.response, null, 2)} open />}
                  <Block title="Prompt systemowy" text={c.request.system ?? ""} />
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Block({ title, text, open = false }: { title: string; text: string; open?: boolean }) {
  return (
    <details open={open}>
      <summary className="cursor-pointer font-semibold text-ink">{title}</summary>
      <pre className="mt-1 max-h-96 overflow-auto rounded-lg bg-slate-50 p-2 text-xs whitespace-pre-wrap break-words">{text}</pre>
    </details>
  );
}

const KIND_LABELS: Record<LlmCall["kind"], string> = { extraction: "analiza", document: "kontrola zdjęcia", triage: "wstępna ocena" };

function resultLabel(c: LlmCall): string {
  if (c.kind === "triage") return c.response?.relevant ? "do analizy" : "pominięte";
  if (c.kind === "document") return c.response?.containsPeople ? "widać ludzi – obraz usunięty" : "dokument bez ludzi";
  return operationsLabel(c.response?.operations?.length ?? 0);
}

function operationsLabel(n: number): string {
  if (n === 0) return "bez operacji";
  if (n === 1) return "1 operacja";
  const lastTwo = n % 100;
  return n % 10 >= 2 && n % 10 <= 4 && (lastTwo < 12 || lastTwo > 14) ? `${n} operacje` : `${n} operacji`;
}

function usageLabel(c: LlmCall): string {
  const parts: string[] = [];
  if (c.usage?.input_tokens != null) parts.push(`${c.usage.input_tokens} → ${c.usage.output_tokens ?? 0} tokenów`);
  if (c.duration_ms != null) parts.push(`${(c.duration_ms / 1000).toFixed(1)} s`);
  return parts.join(" · ");
}

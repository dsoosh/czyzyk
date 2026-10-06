import { useState, type FormEvent } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { useLayoutContext } from "../../components/Layout";
import { LoadError, Loading, SourceLink } from "../../components/ui";
import { shortDate } from "../../lib/dates";
import { confidenceLabel, fetchGroupNames, formatAmount, groupLabel } from "../../lib/items";
import {
  FIELDS,
  KIND_LABELS,
  fetchReviewQueue,
  parseForm,
  reviewItem,
  toFormValues,
  type Field,
  type FormValues,
  type QueueItem,
  type ReviewAction,
} from "../../lib/review";
import { useLoader } from "../../lib/useLoader";

function formatValue(field: Field, value: unknown): string {
  if (value == null || value === "") return "—";
  switch (field.type) {
    case "bool":
      return value ? "tak" : "nie";
    case "date":
      return shortDate(String(value));
    case "datetime": {
      const [day, time] = String(value).split("T");
      return time ? `${shortDate(day!)} ${time}` : shortDate(day!);
    }
    case "money":
      return formatAmount(value as number);
    default:
      return String(value);
  }
}

function Fields({ item, data, changedOnly }: { item: QueueItem; data: Record<string, unknown>; changedOnly?: boolean }) {
  const fields = FIELDS[item.kind].filter((f) => !changedOnly || f.name in data);
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
      {fields.map((f) => (
        <div key={f.name} className="contents">
          <dt className="text-slate-500">{f.label}</dt>
          <dd className="font-medium">{formatValue(f, data[f.name])}</dd>
        </div>
      ))}
    </dl>
  );
}

function EditForm({
  item,
  initial,
  busy,
  onSave,
  onCancel,
}: {
  item: QueueItem;
  initial: Record<string, unknown>;
  busy: boolean;
  onSave: (data: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<FormValues>(() => toFormValues(item.kind, initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (name: string, value: string | boolean) => setValues((v) => ({ ...v, [name]: value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const result = parseForm(item.kind, values);
    if (!result.ok) return setErrors(result.errors);
    setErrors({});
    onSave(result.data);
  };

  return (
    <form onSubmit={submit} aria-label="Popraw element" className="space-y-3">
      {FIELDS[item.kind].map((f) => {
        const id = `${item.id}-${f.name}`;
        const error = errors[f.name];
        if (f.type === "bool") {
          return (
            <label key={f.name} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={values[f.name] === true} onChange={(e) => set(f.name, e.target.checked)} />
              {f.label}
            </label>
          );
        }
        const allDay = values.all_day === true;
        const inputType =
          f.type === "date" || (f.type === "datetime" && allDay) ? "date" : f.type === "datetime" ? "datetime-local" : "text";
        let value = String(values[f.name] ?? "");
        if (inputType === "date") value = value.slice(0, 10);
        if (inputType === "datetime-local" && value && !value.includes("T")) value = `${value}T09:00`;
        return (
          <div key={f.name} className="space-y-1">
            <label htmlFor={id} className="block text-sm text-slate-600">
              {f.label}
              {f.optional && " (opcjonalnie)"}
            </label>
            {f.type === "category" ? (
              <select id={id} value={value} onChange={(e) => set(f.name, e.target.value)} className="w-full rounded-lg border border-slate-300 px-2 py-2">
                {["godziny", "kontakt", "osoba", "inne"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            ) : (
              <input
                id={id}
                type={inputType}
                inputMode={f.type === "money" ? "decimal" : undefined}
                value={value}
                onChange={(e) => set(f.name, e.target.value)}
                aria-invalid={error ? true : undefined}
                className="w-full rounded-lg border border-slate-300 px-2 py-2"
              />
            )}
            {error && <p className="text-sm text-red-700">{error}</p>}
          </div>
        );
      })}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="flex-1 rounded-lg bg-brand-700 py-2 font-semibold text-white disabled:opacity-50">
          Zapisz i zatwierdź
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2">
          Anuluj
        </button>
      </div>
    </form>
  );
}

function QueueCard({ item, groups, onDone }: { item: QueueItem; groups: Map<string, string>; onDone: () => void }) {
  const { client } = useAuth();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const proposal = item.pending_patch;

  const act = async (action: ReviewAction, patch?: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await reviewItem(client, item.kind, item.id, action, patch);
      onDone();
    } catch {
      setError("Nie udało się zapisać decyzji.");
      setBusy(false);
    }
  };

  const btn = "rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50";
  const confidence = proposal?.confidence ?? item.confidence;

  return (
    <li aria-label={`${KIND_LABELS[item.kind]}: ${String(Object.values(item.data)[0] ?? "")}`} className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded bg-brand-100 px-1.5 py-0.5 font-semibold text-brand-800">{KIND_LABELS[item.kind]}</span>
        <span className="text-slate-500">{groupLabel(groups, item.group_id)}</span>
        <span className="text-slate-500">
          pewność {confidenceLabel(confidence)}
          {confidence != null && ` (${Math.round(confidence * 100)}%)`}
        </span>
      </div>

      <Fields item={item} data={item.data} />

      {proposal && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3">
          <p className="mb-2 text-sm font-semibold text-amber-900">
            {proposal.op === "cancel" ? "Nowa wiadomość sugeruje odwołanie" : "Nowa wiadomość proponuje zmianę"}
          </p>
          {proposal.data && <Fields item={item} data={proposal.data} changedOnly />}
          {proposal.rationale && <p className="mt-2 text-sm text-amber-900">{proposal.rationale}</p>}
        </div>
      )}
      {!proposal && item.rationale && <p className="text-sm text-slate-600">{item.rationale}</p>}

      <SourceLink kind={item.kind} id={item.id} />
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      {editing ? (
        <EditForm
          item={item}
          initial={{ ...item.data, ...(proposal?.data ?? {}) }}
          busy={busy}
          onSave={(data) => void act("approve", data)}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          {proposal?.op === "update" && (
            <button type="button" disabled={busy} onClick={() => void act("approve", proposal.data)} className={`${btn} bg-brand-700 text-white`}>
              Przyjmij zmianę
            </button>
          )}
          {proposal?.op === "cancel" && (
            <button type="button" disabled={busy} onClick={() => void act("reject")} className={`${btn} bg-red-700 text-white`}>
              Odwołaj
            </button>
          )}
          {!proposal && (
            <button type="button" disabled={busy} onClick={() => void act("approve")} className={`${btn} bg-brand-700 text-white`}>
              Zatwierdź
            </button>
          )}
          <button type="button" disabled={busy} onClick={() => setEditing(true)} className={`${btn} border border-slate-300`}>
            Popraw
          </button>
          {proposal ? (
            <button type="button" disabled={busy} onClick={() => void act("dismiss")} className={`${btn} border border-slate-300`}>
              Zostaw jak jest
            </button>
          ) : (
            <button type="button" disabled={busy} onClick={() => void act("reject")} className={`${btn} border border-red-300 text-red-700`}>
              Odrzuć
            </button>
          )}
        </div>
      )}
    </li>
  );
}

export function ReviewPage() {
  const { client } = useAuth();
  const { refreshReviewCount } = useLayoutContext();
  const { data, error, loading, reload } = useLoader(
    async () => {
      const [items, groups] = await Promise.all([fetchReviewQueue(client), fetchGroupNames(client)]);
      return { items, groups };
    },
    [client],
  );

  if (error) return <LoadError message={error} onRetry={reload} />;
  if (!data) return loading ? <Loading /> : null;

  return (
    <div className="space-y-4">
      <h1 className="font-display text-4xl font-bold text-ink">Do przejrzenia</h1>
      {data.items.length === 0 ? (
        <p className="rounded-2xl bg-white p-4 text-slate-500 shadow-sm">Nic nie czeka na przegląd</p>
      ) : (
        <ul className="space-y-3">
          {data.items.map((item) => (
            <QueueCard
              key={`${item.kind}:${item.id}:${item.updated_at}`}
              item={item}
              groups={data.groups}
              onDone={() => {
                reload();
                refreshReviewCount();
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

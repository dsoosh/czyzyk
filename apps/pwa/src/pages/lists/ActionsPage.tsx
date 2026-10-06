import { useState } from "react";
import { useAuth, useProfile } from "../../auth/AuthProvider";
import { DoneToggle, LoadError, Loading, Meta, Row, Section, SourceLink } from "../../components/ui";
import { addDays, dayLabel, warsawDay } from "../../lib/dates";
import { groupLabel, type ActionRequired } from "../../lib/items";
import { doneLabel, fetchActionList } from "../../lib/tracking";
import { useLoader, useOnForeground } from "../../lib/useLoader";
import { useMarkDone } from "../../lib/useMarkDone";

export function ActionsPage() {
  const { client } = useAuth();
  const me = useProfile().id;
  const [today] = useState(() => warsawDay(new Date()));
  const { data, error, loading, reload } = useLoader(() => fetchActionList(client), [client]);
  const mark = useMarkDone("action_required", reload);
  useOnForeground(reload);

  if (error) return <LoadError message={error} onRetry={reload} />;
  if (!data) return loading ? <Loading /> : null;

  const row = (a: ActionRequired) => (
    <Row key={a.id}>
      <div className="flex items-start gap-3">
        <DoneToggle
          checked={a.resolved_at != null}
          label={`${a.question}: załatwione`}
          disabled={mark.pending === a.id}
          onToggle={() => void mark.toggle(a.id, a.resolved_at == null)}
        />
        <div className="flex flex-1 flex-col gap-1">
          <span className={a.resolved_at ? "text-slate-400" : "font-medium"}>{a.question}</span>
          <Meta>
            {a.due_date && (
              <span className={!a.resolved_at && a.due_date < addDays(today, 2) ? "font-semibold text-red-700" : ""}>
                do {dayLabel(a.due_date, today)}
              </span>
            )}
            {a.resolved_at && <span>{doneLabel("załatwione", a.resolved_by, a.resolved_at, me, data.people, today)}</span>}
            <span>{groupLabel(data.groups, a.group_id)}</span>
            <SourceLink kind="action_required" id={a.id} />
          </Meta>
        </div>
      </div>
    </Row>
  );

  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl font-bold text-ink">Wymaga odpowiedzi</h1>
      {mark.error && <p role="alert" className="text-red-700">{mark.error}</p>}
      <Section title="Otwarte" empty="Nic nie czeka na odpowiedź">
        {data.open.map(row)}
      </Section>
      {data.resolved.length > 0 && (
        <details className="space-y-2">
          <summary className="cursor-pointer text-sm font-semibold tracking-wide text-slate-500 uppercase">
            Załatwione ({data.resolved.length})
          </summary>
          <ul aria-label="Załatwione" className="mt-2 divide-y divide-slate-100 rounded-2xl bg-white shadow-sm">
            {data.resolved.map(row)}
          </ul>
        </details>
      )}
    </div>
  );
}

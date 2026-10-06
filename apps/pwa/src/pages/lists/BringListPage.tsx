import { useState } from "react";
import { useAuth, useProfile } from "../../auth/AuthProvider";
import { ChildTag, DoneToggle, LoadError, Loading, Meta, Row, Section, SourceLink } from "../../components/ui";
import { childNames } from "../../lib/children";
import { dayLabel, warsawDay } from "../../lib/dates";
import { groupLabel, type BringItem } from "../../lib/items";
import { doneLabel, fetchBringList } from "../../lib/tracking";
import { useLoader, useOnForeground } from "../../lib/useLoader";
import { useMarkDone } from "../../lib/useMarkDone";

export function BringListPage() {
  const { client } = useAuth();
  const me = useProfile().id;
  const [today] = useState(() => warsawDay(new Date()));
  const { data, error, loading, reload } = useLoader(() => fetchBringList(client, today), [client, today]);
  const mark = useMarkDone("bring_item", reload);
  useOnForeground(reload);

  if (error) return <LoadError message={error} onRetry={reload} />;
  if (!data) return loading ? <Loading /> : null;

  const byDay = new Map<string, BringItem[]>();
  for (const item of data.items) {
    const key = item.due_date ?? "";
    byDay.set(key, [...(byDay.get(key) ?? []), item]);
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl font-bold text-ink">Do przyniesienia</h1>
      {mark.error && <p role="alert" className="text-red-700">{mark.error}</p>}
      {byDay.size === 0 && <p className="rounded-2xl bg-white p-4 text-slate-500 shadow-sm">Nic do przyniesienia</p>}
      {[...byDay].map(([day, items]) => (
        <Section key={day} title={day ? `Na ${dayLabel(day, today)}` : "Bez terminu"} empty="">
          {items.map((b) => (
            <Row key={b.id}>
              <div className="flex items-start gap-3">
                <DoneToggle
                  checked={b.packed_at != null}
                  label={b.description}
                  disabled={mark.pending === b.id}
                  onToggle={() => void mark.toggle(b.id, b.packed_at == null)}
                />
                <div className="flex flex-1 flex-col gap-1">
                  <span className={b.packed_at ? "text-slate-400 line-through" : "font-medium"}>{b.description}</span>
                  <Meta>
                    {b.packed_at && <span>{doneLabel("spakowane", b.packed_by, b.packed_at, me, data.people, today)}</span>}
                    <ChildTag names={childNames(data.children, b)} />
            <span>{groupLabel(data.groups, b.group_id)}</span>
                    <SourceLink kind="bring_item" id={b.id} />
                  </Meta>
                </div>
              </div>
            </Row>
          ))}
        </Section>
      ))}
    </div>
  );
}

import { useState } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { LoadError, Loading, Meta, Row, Section, SourceLink } from "../../components/ui";
import { longDayLabel, shortDate, warsawDay } from "../../lib/dates";
import { groupLabel, type Closure } from "../../lib/items";
import { fetchClosureList } from "../../lib/tracking";
import { useLoader, useOnForeground } from "../../lib/useLoader";

/** "23.12–1.01 · przerwa świąteczna" */
export function closureLine(c: Closure): string {
  const when = c.date_from === c.date_to ? longDayLabel(c.date_from) : `${shortDate(c.date_from)}–${shortDate(c.date_to)}`;
  return c.reason ? `${when} · ${c.reason}` : when;
}

export function ClosuresPage() {
  const { client } = useAuth();
  const [today] = useState(() => warsawDay(new Date()));
  const { data, error, loading, reload } = useLoader(() => fetchClosureList(client, today), [client, today]);
  useOnForeground(reload);

  if (error) return <LoadError message={error} onRetry={reload} />;
  if (!data) return loading ? <Loading /> : null;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl font-bold text-ink">Dni wolne</h1>
      <Section title="Nadchodzące" empty="Brak zapowiedzianych dni wolnych">
        {data.closures.map((c) => (
          <Row key={c.id}>
            <span className="font-medium">{closureLine(c)}</span>
            <Meta>
              <span>{groupLabel(data.groups, c.group_id)}</span>
              <SourceLink kind="closure" id={c.id} />
            </Meta>
          </Row>
        ))}
      </Section>
    </div>
  );
}

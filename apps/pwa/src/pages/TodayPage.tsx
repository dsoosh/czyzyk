import { Link } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { LoadError, Loading, Meta, Row, Section, SourceLink } from "../components/ui";
import { addDays, dayLabel, longDayLabel, shortDate, warsawDay, warsawTime } from "../lib/dates";
import { fetchToday, formatAmount, groupLabel, type Closure } from "../lib/items";
import { useLoader, useOnForeground } from "../lib/useLoader";
import { useState } from "react";

function closureBanner(c: Closure, today: string): string {
  const reason = c.reason ? ` (${c.reason})` : "";
  if (c.date_from <= today) {
    return c.date_to === today
      ? `Dziś przedszkole nieczynne${reason}`
      : `Przedszkole nieczynne do ${shortDate(c.date_to)}${reason}`;
  }
  const when = c.date_from === c.date_to ? longDayLabel(c.date_from) : `${shortDate(c.date_from)}–${shortDate(c.date_to)}`;
  return `${when} – przedszkole nieczynne${reason}`;
}

export function TodayPage() {
  const { client } = useAuth();
  const [today, setToday] = useState(() => warsawDay(new Date()));
  const { data, error, loading, reload } = useLoader(() => fetchToday(client, today), [client, today]);

  // Returning to the app (e.g. after midnight) recomputes "today" and refreshes the data.
  useOnForeground(() => {
    const now = warsawDay(new Date());
    if (now !== today) setToday(now);
    else reload();
  });

  if (error) return <LoadError message={error} onRetry={reload} />;
  if (!data) return loading ? <Loading /> : null;
  const g = (id: string | null) => groupLabel(data.groups, id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-brand-900">Dziś i jutro</h1>

      {data.closures.map((c) => (
        <div key={c.id} role="status" className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 font-semibold text-amber-900">
          {closureBanner(c, today)}
          <div className="mt-1 font-normal">
            <SourceLink kind="closure" id={c.id} />
          </div>
        </div>
      ))}

      <Section title="Na jutro przynieść" empty="Na jutro nic do przyniesienia">
        {data.bringTomorrow.map((b) => (
          <Row key={b.id}>
            <span className={b.packed_at ? "text-slate-400 line-through" : "font-medium"}>{b.description}</span>
            <Meta>
              <span>{g(b.group_id)}</span>
              {b.packed_at && <span>spakowane</span>}
              <SourceLink kind="bring_item" id={b.id} />
            </Meta>
          </Row>
        ))}
      </Section>

      <Section title="Wydarzenia" empty="Brak wydarzeń w najbliższym tygodniu">
        {data.events.map((e) => {
          const day = warsawDay(e.starts_at);
          return (
            <Row key={e.id}>
              <Link to={`/kalendarz/wydarzenie/${e.id}`} className="font-medium hover:underline">
                {e.title}
              </Link>
              <Meta>
                <span className="font-semibold text-brand-700">{dayLabel(day, today)}</span>
                <span>{e.all_day ? "cały dzień" : warsawTime(e.starts_at)}</span>
                <span>{g(e.group_id)}</span>
                <SourceLink kind="event" id={e.id} />
              </Meta>
            </Row>
          );
        })}
      </Section>

      <Section title="Płatności" empty="Brak płatności z bliskim terminem">
        {data.payments.map((p) => (
          <Row key={p.id}>
            <span className="font-medium">
              {p.description} {p.amount_pln != null && <span className="text-brand-700">· {formatAmount(p.amount_pln)}</span>}
            </span>
            <Meta>
              <span className={p.due_date! < today ? "font-semibold text-red-700" : ""}>
                {p.due_date! < today ? "po terminie: " : "do "}
                {dayLabel(p.due_date!, today)}
              </span>
              <span>{g(p.group_id)}</span>
              <SourceLink kind="payment" id={p.id} />
            </Meta>
          </Row>
        ))}
      </Section>

      <Section title="Wymaga odpowiedzi" empty="Nic nie czeka na odpowiedź">
        {data.actions.map((a) => (
          <Row key={a.id}>
            <span className="font-medium">{a.question}</span>
            <Meta>
              {a.due_date && (
                <span className={a.due_date < addDays(today, 2) ? "font-semibold text-red-700" : ""}>
                  do {dayLabel(a.due_date, today)}
                </span>
              )}
              <span>{g(a.group_id)}</span>
              <SourceLink kind="action_required" id={a.id} />
            </Meta>
          </Row>
        ))}
      </Section>
    </div>
  );
}

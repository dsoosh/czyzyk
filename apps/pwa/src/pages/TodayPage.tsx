import { Link } from "react-router";
import { useAuth, useProfile } from "../auth/AuthProvider";
import { ChildTag, DoneToggle, LoadError, Loading, Meta, Row, Section, SourceLink } from "../components/ui";
import { childNames } from "../lib/children";
import { addDays, dayLabel, longDayLabel, shortDate, warsawDay, warsawTime } from "../lib/dates";
import { fetchToday, formatAmount, groupLabel, type Closure } from "../lib/items";
import { doneLabel } from "../lib/tracking";
import { useLoader, useOnForeground } from "../lib/useLoader";
import { useMarkDone } from "../lib/useMarkDone";
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
  const me = useProfile().id;
  const [today, setToday] = useState(() => warsawDay(new Date()));
  const { data, error, loading, reload } = useLoader(() => fetchToday(client, today), [client, today]);
  const mark = useMarkDone("bring_item", reload);

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
      <div className="space-y-0.5">
        <p className="text-sm text-muted">{longDayLabel(today)}</p>
        <h1 className="font-display text-[52px] leading-none font-bold text-ink">Dziś i jutro</h1>
      </div>

      {data.closures.map((c) => (
        <div key={c.id} role="status" className="rounded-[28px] bg-sun/35 px-5 py-4 font-semibold text-ink">
          {closureBanner(c, today)}
          <div className="mt-1 font-normal">
            <SourceLink kind="closure" id={c.id} />
          </div>
        </div>
      ))}

      {mark.error && (
        <p role="alert" className="text-red-700">
          {mark.error}
        </p>
      )}

      <Section title="Na jutro przynieść" empty="Na jutro nic do przyniesienia" stripe="earth">
        {data.bringTomorrow.map((b) => (
          <Row key={b.id}>
            <div className="flex items-start gap-3">
              <DoneToggle
                checked={b.packed_at != null}
                label={b.description}
                disabled={mark.pending === b.id}
                onToggle={() => void mark.toggle(b.id, b.packed_at == null)}
              />
              <div className="flex flex-1 flex-col gap-1">
                <span className={b.packed_at ? "text-muted line-through" : "font-semibold"}>{b.description}</span>
                <Meta>
                  {b.packed_at && <span>{doneLabel("spakowane", b.packed_by, b.packed_at, me, data.people, today)}</span>}
                  <ChildTag names={childNames(data.children, b)} />
                  <span>{g(b.group_id)}</span>
                  <SourceLink kind="bring_item" id={b.id} />
                </Meta>
              </div>
            </div>
          </Row>
        ))}
      </Section>

      <Section title="Wydarzenia" empty="Brak wydarzeń w najbliższym tygodniu" stripe="sun">
        {data.events.map((e) => {
          const day = warsawDay(e.starts_at);
          return (
            <Row key={e.id}>
              <Link to={`/kalendarz/wydarzenie/${e.id}`} className="font-semibold hover:underline">
                {e.title}
              </Link>
              <Meta>
                <span className="font-semibold text-ink">{dayLabel(day, today)}</span>
                <span>{e.all_day ? "cały dzień" : warsawTime(e.starts_at)}</span>
                <ChildTag names={childNames(data.children, e)} />
                <span>{g(e.group_id)}</span>
                <SourceLink kind="event" id={e.id} />
              </Meta>
            </Row>
          );
        })}
      </Section>

      <Section title="Płatności" empty="Brak płatności z bliskim terminem" stripe="water">
        {data.payments.map((p) => {
          const overdue = p.due_date! < today;
          return (
            <Row key={p.id}>
              <div className="flex items-center gap-3">
                <div className="flex flex-1 flex-col gap-1">
                  <span className="font-semibold">{p.description}</span>
                  <Meta>
                    <span className={overdue ? "font-semibold text-red-700" : ""}>
                      {overdue ? "po terminie: " : "do "}
                      {dayLabel(p.due_date!, today)}
                    </span>
                    <ChildTag names={childNames(data.children, p)} />
                    <span>{g(p.group_id)}</span>
                    <SourceLink kind="payment" id={p.id} />
                  </Meta>
                </div>
                {p.amount_pln != null && <span className="text-[17px] font-bold whitespace-nowrap">{formatAmount(p.amount_pln)}</span>}
              </div>
            </Row>
          );
        })}
      </Section>

      <Section title="Wymaga odpowiedzi" empty="Nic nie czeka na odpowiedź" stripe="air">
        {data.actions.map((a) => (
          <Row key={a.id}>
            <span className="font-semibold">{a.question}</span>
            <Meta>
              {a.due_date && (
                <span className={a.due_date < addDays(today, 2) ? "font-semibold text-red-700" : ""}>
                  do {dayLabel(a.due_date, today)}
                </span>
              )}
              <ChildTag names={childNames(data.children, a)} />
              <span>{g(a.group_id)}</span>
              <SourceLink kind="action_required" id={a.id} />
            </Meta>
          </Row>
        ))}
      </Section>
    </div>
  );
}

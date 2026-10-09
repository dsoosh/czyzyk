import { Link } from "react-router";
import { useAuth, useProfile } from "../auth/AuthProvider";
import { ActionSuggestions } from "../components/ActionSuggestions";
import { ChildTag, DoneToggle, LoadError, Loading, Meta, Row, Section, SourceLink } from "../components/ui";
import { childrenOf } from "../lib/children";
import { addDays, dayLabel, longDayLabel, shortDate, warsawDay, warsawTime } from "../lib/dates";
import { eventKey, repeatLabel } from "../lib/recurrence";
import { fetchToday, formatAmount, groupLabel, type BringItem, type Closure, type TodayData } from "../lib/items";
import { doneLabel } from "../lib/tracking";
import { useLoader, useOnForeground } from "../lib/useLoader";
import { FamilyInvites } from "./FamilyInvites";
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

/**
 * Packing checklist rows (an array, so Section can count them and show its empty state);
 * withDay labels each item with its day ("jutro", "pt 16.10").
 */
function bringRows(
  items: BringItem[],
  { data, today, me, mark, withDay = false }: { data: TodayData; today: string; me: string; mark: ReturnType<typeof useMarkDone>; withDay?: boolean },
) {
  return items.map((b) => (
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
            {withDay && b.due_date && <span className="font-semibold text-ink">{dayLabel(b.due_date, today)}</span>}
            {b.packed_at && <span>{doneLabel("spakowane", b.packed_by, b.packed_at, me, data.people, today)}</span>}
            <ChildTag kids={childrenOf(data.children, b)} all={data.children} />
            <span>{groupLabel(data.groups, b.group_id)}</span>
            <SourceLink kind="bring_item" id={b.id} />
          </Meta>
        </div>
      </div>
    </Row>
  ));
}

export function TodayPage() {
  const { client } = useAuth();
  const me = useProfile().id;
  const [today, setToday] = useState(() => warsawDay(new Date()));
  const { data, error, loading, reload } = useLoader(() => fetchToday(client, today), [client, today]);
  const mark = useMarkDone("bring_item", reload);
  const pay = useMarkDone("payment", reload);
  const [applied, setApplied] = useState<string | null>(null);

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

      <FamilyInvites onJoined={reload} />
      {data.children.length === 0 && <AddChildHint />}

      {data.closures.map((c) => (
        <div key={c.id} role="status" className="rounded-[28px] bg-sun/35 px-5 py-4 font-semibold text-ink">
          {closureBanner(c, today)}
          <div className="mt-1 font-normal">
            <SourceLink kind="closure" id={c.id} />
          </div>
        </div>
      ))}

      {applied && (
        <p role="status" className="text-sm text-ink">
          {applied}
        </p>
      )}

      {(mark.error ?? pay.error) && (
        <p role="alert" className="text-red-700">
          {mark.error ?? pay.error}
        </p>
      )}

      {/* Phone: one column; desktop: the sections in a two-column grid. */}
      <div className="space-y-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-8 lg:gap-y-8 lg:space-y-0">
        <Section title="Na dziś przynieść" empty="Na dziś nic do przyniesienia" stripe="earth">
          {bringRows(data.bringToday, { data, today, me, mark })}
        </Section>

        <Section title="W najbliższych dniach" empty="W najbliższych dniach nic do przyniesienia" stripe="earth">
          {bringRows(data.bringWeek, { data, today, me, mark, withDay: true })}
        </Section>

        <Section title="Wydarzenia" empty="Brak wydarzeń w najbliższym tygodniu" stripe="sun">
          {data.events.map((e) => {
            const day = warsawDay(e.starts_at);
            return (
              <Row key={eventKey(e)}>
                <Link to={`/kalendarz/wydarzenie/${e.id}`} className="font-semibold hover:underline">
                  {e.title}
                </Link>
                <Meta>
                  <span className="font-semibold text-ink">{dayLabel(day, today)}</span>
                  <span>{e.all_day ? "cały dzień" : warsawTime(e.starts_at)}</span>
                  {repeatLabel(e) && <span>{repeatLabel(e)}</span>}
                  {e.location && <span>📍 {e.location}</span>}
                  {e.meeting_point && <span>zbiórka: {e.meeting_point}</span>}
                  <ChildTag kids={childrenOf(data.children, e)} all={data.children} />
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
                  {/* Paid: the payment leaves "Dziś" and moves to Listy → Płatności → Zapłacone. */}
                  <DoneToggle
                    checked={false}
                    label={`${p.description}: zapłacone`}
                    disabled={pay.pending === p.id}
                    onToggle={() => void pay.toggle(p.id, true)}
                  />
                  <div className="flex flex-1 flex-col gap-1">
                    <span className="font-semibold">{p.description}</span>
                    <Meta>
                      <span className={overdue ? "font-semibold text-red-700" : ""}>
                        {overdue ? "po terminie: " : "do "}
                        {dayLabel(p.due_date!, today)}
                      </span>
                      <ChildTag kids={childrenOf(data.children, p)} all={data.children} />
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
                <ChildTag kids={childrenOf(data.children, a)} all={data.children} />
                <span>{g(a.group_id)}</span>
                <SourceLink kind="action_required" id={a.id} />
              </Meta>
              <ActionSuggestions
                item={a}
                onApplied={(message) => {
                  setApplied(message);
                  reload();
                }}
              />
            </Row>
          ))}
        </Section>
      </div>
    </div>
  );
}

/**
 * Until the family adds a child (families), it sees only shared groups: a hint on the home
 * screen leads to the form for the first child.
 */
function AddChildHint() {
  return (
    <section aria-label="Dodaj dziecko" className="space-y-2 rounded-[28px] bg-sun/35 px-5 py-4 text-ink">
      <h2 className="font-display text-2xl font-bold">Dodaj swoje dziecko</h2>
      <p className="text-sm">
        Czyżyk pokazuje sprawy z grup, do których chodzą Twoje dzieci. Dodaj dziecko i wybierz jego grupę, a zobaczysz wydarzenia,
        rzeczy do przyniesienia i płatności.
      </p>
      <Link to="/ustawienia?dziecko=nowe" className="inline-block rounded-full bg-ink px-5 py-2 font-semibold text-cream">
        Dodaj dziecko
      </Link>
    </section>
  );
}

import { Link } from "react-router";
import { useAuth, useProfile } from "../auth/AuthProvider";
import { KindTag } from "../components/KindTag";
import { ResolveButton } from "../components/ResolveButton";
import { ChildTag, DoneToggle, LoadError, Loading, Meta, Row, Section, SourceLink } from "../components/ui";
import { childrenOf } from "../lib/children";
import { addDays, dayLabel, longDayLabel, shortDate, warsawDay, warsawTime } from "../lib/dates";
import { eventKey, repeatLabel } from "../lib/recurrence";
import { fetchToday, formatAmount, itemGroupsLabel, type BringItem, type Closure, type EventItem, type TodayData } from "../lib/items";
import { lastDay } from "../lib/spans";
import { DropOffs } from "../components/PlaceTag";
import { doneLabel } from "../lib/tracking";
import { useLoader, useOnForeground } from "../lib/useLoader";
import { FamilyInvites } from "./FamilyInvites";
import { useMarkDone } from "../lib/useMarkDone";
import { useState, type ReactNode } from "react";

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
            <span>{itemGroupsLabel(data.groups, b)}</span>
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
  const resolve = useMarkDone("action_required", reload);

  // Returning to the app (e.g. after midnight) recomputes "today" and refreshes the data.
  useOnForeground(() => {
    const now = warsawDay(new Date());
    if (now !== today) setToday(now);
    else reload();
  });

  if (error) return <LoadError message={error} onRetry={reload} />;
  if (!data) return loading ? <Loading /> : null;
  const tomorrow = addDays(today, 1);

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

      {resolve.error && (
        <p role="alert" className="text-red-700">
          {resolve.error}
        </p>
      )}

      {(mark.error ?? pay.error) && (
        <p role="alert" className="text-red-700">
          {mark.error ?? pay.error}
        </p>
      )}

      {/* Phone: one column; desktop: the sections in a two-column grid. */}
      <div className="space-y-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-8 lg:gap-y-8 lg:space-y-0">
        <DaySection title="Dzisiaj" day={today} {...{ data, today, me, mark }} />
        <DaySection title="Jutro" day={tomorrow} {...{ data, today, me, mark }} />

        <Section title="W najbliższych dniach" empty="W najbliższych dniach nic do przyniesienia" stripe="earth">
          {bringRows(
            data.bringWeek.filter((b) => b.due_date !== tomorrow),
            { data, today, me, mark, withDay: true },
          )}
        </Section>

        <Section title="Wydarzenia" empty="Brak dalszych wydarzeń w tym tygodniu" stripe="sun">
          {data.events
            .filter((e) => warsawDay(e.starts_at) > tomorrow)
            .map((e) => (
              <EventRow key={eventKey(e)} e={e} data={data} today={today} withDay />
            ))}
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
                      <span>{itemGroupsLabel(data.groups, p)}</span>
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
                {a.kind && <KindTag kind={a.kind} />}
                {a.due_date && (
                  <span className={a.due_date < addDays(today, 2) ? "font-semibold text-red-700" : ""}>
                    do {dayLabel(a.due_date, today)}
                  </span>
                )}
                <ChildTag kids={childrenOf(data.children, a)} all={data.children} />
                <span>{itemGroupsLabel(data.groups, a)}</span>
                <SourceLink kind="action_required" id={a.id} />
              </Meta>
              <ResolveButton question={a.question} disabled={resolve.pending === a.id} onResolve={() => void resolve.toggle(a.id, true)} />
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

/** One event in a list: time, title, place and where to bring the child. */
function EventRow({ e, data, today, withDay = false }: { e: EventItem; data: TodayData; today: string; withDay?: boolean }) {
  const day = warsawDay(e.starts_at);
  return (
    <Row>
      <Link to={`/kalendarz/wydarzenie/${e.id}`} className="font-semibold hover:underline">
        {e.title}
      </Link>
      <Meta>
        {withDay && <span className="font-semibold text-ink">{dayLabel(day, today)}</span>}
        <span>{e.all_day ? "cały dzień" : warsawTime(e.starts_at)}</span>
        {repeatLabel(e) && <span>{repeatLabel(e)}</span>}
        {e.location && <span>📍 {e.location}</span>}
        {e.drop_offs?.length ? <DropOffs items={e.drop_offs} /> : e.meeting_point && <span>zbiórka: {e.meeting_point}</span>}
        <ChildTag kids={childrenOf(data.children, e)} all={data.children} />
        <span>{itemGroupsLabel(data.groups, e)}</span>
        <SourceLink kind="event" id={e.id} />
      </Meta>
    </Row>
  );
}

/**
 * The whole day at a glance (today-view): closures, where to take the child, events and what to
 * bring; subsections without anything are left out.
 */
function DaySection({
  title,
  day,
  data,
  today,
  me,
  mark,
}: {
  title: string;
  day: string;
  data: TodayData;
  today: string;
  me: string;
  mark: ReturnType<typeof useMarkDone>;
}) {
  const events = data.events.filter((e) => warsawDay(e.starts_at) <= day && day <= lastDay(e));
  const bring = [...data.bringToday, ...data.bringWeek].filter((b) => b.due_date === day);
  const closed = data.closures.filter((c) => c.date_from <= day && day <= c.date_to);
  const dropOffs = events.filter((e) => e.drop_offs?.length);
  const quiet = events.length === 0 && bring.length === 0 && closed.length === 0;
  const sub = (label: string, children: ReactNode) => (
    <div className="space-y-1">
      <h3 className="pt-3 text-[12px] font-bold tracking-wider text-muted uppercase">{label}</h3>
      <ul className="divide-y divide-ink/10">{children}</ul>
    </div>
  );
  return (
    <section aria-label={title} className="space-y-2.5">
      <div className="flex items-center gap-2.5">
        <span aria-hidden="true" className="h-2.5 w-7 shrink-0 rounded-full bg-sun" />
        <h2 className="flex-1 text-[13px] font-bold tracking-wider text-ink uppercase">
          {title} <span className="font-semibold text-muted normal-case">· {longDayLabel(day)}</span>
        </h2>
      </div>
      <div className="rounded-[28px] bg-card px-5 pb-2 shadow-sm">
        {closed.map((c) => (
          <p key={c.id} role="status" className="pt-3 font-semibold text-ink">
            Przedszkole nieczynne{c.reason ? ` (${c.reason})` : ""}
          </p>
        ))}
        {dropOffs.length > 0 &&
          sub(
            "Gdzie zawieźć",
            dropOffs.map((e) => (
              <Row key={eventKey(e)}>
                <DropOffs items={e.drop_offs!} />
                <span className="text-[13px] text-muted">{e.title}</span>
              </Row>
            )),
          )}
        {events.length > 0 && sub("Wydarzenia", events.map((e) => <EventRow key={eventKey(e)} e={e} data={data} today={today} />))}
        {bring.length > 0 && sub("Co przynieść", bringRows(bring, { data, today, me, mark }))}
        {quiet && <p className="py-4 text-muted">Zwykły dzień w przedszkolu</p>}
      </div>
    </section>
  );
}


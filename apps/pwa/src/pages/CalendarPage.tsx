import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { LoadError, Loading, Meta, SourceLink } from "../components/ui";
import {
  addDays,
  addMonths,
  daysBetween,
  longDayLabel,
  monthGrid,
  monthTitle,
  warsawDay,
  warsawTime,
} from "../lib/dates";
import { fetchCalendar, groupLabel, type CalendarData, type Closure, type EventItem } from "../lib/items";
import { useLoader } from "../lib/useLoader";

type View = "list" | "month";

interface DayEntries {
  events: EventItem[];
  closures: Closure[];
}

function byDay(data: CalendarData, from: string, to: string): Map<string, DayEntries> {
  const map = new Map<string, DayEntries>();
  const entry = (day: string) => {
    if (!map.has(day)) map.set(day, { events: [], closures: [] });
    return map.get(day)!;
  };
  for (const e of data.events) entry(warsawDay(e.starts_at)).events.push(e);
  for (const c of data.closures) {
    for (const day of daysBetween(c.date_from > from ? c.date_from : from, c.date_to < to ? c.date_to : to)) {
      entry(day).closures.push(c);
    }
  }
  return new Map([...map.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

function DayItems({ entries, groups }: { entries: DayEntries; groups: Map<string, string> }) {
  return (
    <ul className="divide-y divide-slate-100 rounded-2xl bg-white shadow-sm">
      {entries.closures.map((c) => (
        <li key={c.id} className="flex flex-col gap-1 bg-amber-50 p-4">
          <span className="font-medium text-amber-900">Przedszkole nieczynne{c.reason ? ` – ${c.reason}` : ""}</span>
          <Meta>
            <span>{groupLabel(groups, c.group_id)}</span>
            <SourceLink kind="closure" id={c.id} />
          </Meta>
        </li>
      ))}
      {entries.events.map((e) => (
        <li key={e.id} className="flex flex-col gap-1 p-4">
          <Link to={`/kalendarz/wydarzenie/${e.id}`} className="font-medium hover:underline">
            {e.title}
          </Link>
          <Meta>
            <span>{e.all_day ? "cały dzień" : warsawTime(e.starts_at)}</span>
            {e.location && <span>{e.location}</span>}
            <span>{groupLabel(groups, e.group_id)}</span>
            <SourceLink kind="event" id={e.id} />
          </Meta>
        </li>
      ))}
    </ul>
  );
}

function ListView({ today }: { today: string }) {
  const { client } = useAuth();
  const [from, setFrom] = useState(today);
  const to = addDays(today, 180);
  const { data, error, loading, reload } = useLoader(() => fetchCalendar(client, from, to), [client, from, to]);
  if (error) return <LoadError message={error} onRetry={reload} />;
  if (!data) return loading ? <Loading /> : null;
  const days = byDay(data, from, to);

  return (
    <div className="space-y-4">
      <button type="button" className="text-sm text-brand-700 underline" onClick={() => setFrom(addDays(from, -30))}>
        Pokaż wcześniejsze
      </button>
      {days.size === 0 && <p className="rounded-2xl bg-white p-4 text-slate-500 shadow-sm">Brak zaplanowanych wydarzeń</p>}
      {[...days].map(([day, entries]) => (
        <section key={day} aria-label={longDayLabel(day)} className="space-y-2">
          <h2 className={`font-display text-2xl font-bold ${day === today ? "text-brand-700" : "text-ink"}`}>
            {longDayLabel(day)}
            {day === today && " · dziś"}
          </h2>
          <DayItems entries={entries} groups={data.groups} />
        </section>
      ))}
    </div>
  );
}

function MonthView({ today }: { today: string }) {
  const { client } = useAuth();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState<string | null>(today);
  const grid = useMemo(() => monthGrid(month), [month]);
  const from = `${month}-01`;
  const to = addDays(addMonths(month, 1) + "-01", -1);
  const { data, error, loading, reload } = useLoader(() => fetchCalendar(client, from, to), [client, from, to]);
  const days = data ? byDay(data, from, to) : new Map<string, DayEntries>();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button type="button" aria-label="Poprzedni miesiąc" className="rounded-lg px-3 py-1 hover:bg-white" onClick={() => setMonth(addMonths(month, -1))}>
          ‹
        </button>
        <h2 className="font-display text-2xl font-bold capitalize text-ink">{monthTitle(month)}</h2>
        <button type="button" aria-label="Następny miesiąc" className="rounded-lg px-3 py-1 hover:bg-white" onClick={() => setMonth(addMonths(month, 1))}>
          ›
        </button>
      </div>
      {error && <LoadError message={error} onRetry={reload} />}
      <table className="w-full table-fixed rounded-2xl bg-white text-center shadow-sm">
        <thead>
          <tr className="text-xs text-slate-500">
            {["pn", "wt", "śr", "czw", "pt", "sob", "nd"].map((d) => (
              <th key={d} className="py-2 font-medium">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.map((week, i) => (
            <tr key={i}>
              {week.map((day, j) => {
                if (!day) return <td key={j} />;
                const entries = days.get(day);
                const closed = (entries?.closures.length ?? 0) > 0;
                return (
                  <td key={j} className="p-0.5">
                    <button
                      type="button"
                      aria-label={`${longDayLabel(day)}${entries ? `, ${entries.events.length + entries.closures.length} wpisy` : ""}`}
                      aria-pressed={selected === day}
                      onClick={() => setSelected(day)}
                      className={`flex h-11 w-full flex-col items-center justify-center rounded-lg text-sm ${
                        selected === day ? "bg-brand-700 text-white" : closed ? "bg-amber-100" : "hover:bg-brand-50"
                      } ${day === today && selected !== day ? "font-bold text-brand-700" : ""}`}
                    >
                      {Number(day.slice(8))}
                      {entries && entries.events.length > 0 && (
                        <span aria-hidden="true" className={`mt-0.5 h-1.5 w-1.5 rounded-full ${selected === day ? "bg-white" : "bg-brand-600"}`} />
                      )}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {loading && !data && <Loading />}
      {selected && data && (
        <section aria-label={`Wybrany dzień ${longDayLabel(selected)}`} className="space-y-2">
          <h2 className="font-display text-2xl font-bold text-ink">{longDayLabel(selected)}</h2>
          {days.get(selected) ? (
            <DayItems entries={days.get(selected)!} groups={data.groups} />
          ) : (
            <p className="rounded-2xl bg-white p-4 text-slate-500 shadow-sm">Brak wpisów tego dnia</p>
          )}
        </section>
      )}
    </div>
  );
}

export function CalendarPage() {
  const [view, setView] = useState<View>("list");
  const today = warsawDay(new Date());
  const tab = (v: View, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={view === v}
      onClick={() => setView(v)}
      className={`flex-1 rounded-lg py-2 text-sm font-medium ${view === v ? "bg-white text-brand-700 shadow-sm" : "text-slate-600"}`}
    >
      {label}
    </button>
  );
  return (
    <div className="space-y-4">
      <h1 className="font-display text-4xl font-bold text-ink">Kalendarz</h1>
      <div role="tablist" className="flex gap-1 rounded-xl bg-brand-100 p-1">
        {tab("list", "Lista")}
        {tab("month", "Miesiąc")}
      </div>
      {view === "list" ? <ListView today={today} /> : <MonthView today={today} />}
    </div>
  );
}

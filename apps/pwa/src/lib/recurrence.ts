import { addDays, warsawDay, warsawInstant, warsawTime } from "./dates";
import type { Closure, EventItem } from "./items";

/** Short Polish weekday names, ISO order (1 = Monday). */
export const WEEKDAY_SHORT = ["", "pon", "wt", "śr", "czw", "pt", "sob", "niedz"];

/** ISO weekday (1 = Monday … 7 = Sunday) of a local day. */
function isoWeekday(day: string): number {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return ((new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7) + 1;
}

/** "co wt, czw (do 31.01)" for a recurring event, null for a one-off one. */
export function repeatLabel(e: Pick<EventItem, "repeat_weekdays" | "repeat_until">): string | null {
  if (!e.repeat_weekdays?.length) return null;
  const days = [...e.repeat_weekdays].sort().map((d) => WEEKDAY_SHORT[d]).join(", ");
  if (!e.repeat_until) return `co ${days}`;
  const [, m, d] = e.repeat_until.split("-").map(Number);
  return `co ${days} (do ${d}.${String(m).padStart(2, "0")})`;
}

/**
 * Occurrences of recurring events between two local days (inclusive), same rules as the
 * database's event_occurrences: matching weekdays from the first occurrence until
 * repeat_until, skipping closure days of the event's group or the whole kindergarten.
 * Each occurrence keeps the event's id and gets its day in `occurrence_day`.
 */
export function expandRecurring(events: EventItem[], closures: Closure[], fromDay: string, toDay: string): EventItem[] {
  const out: EventItem[] = [];
  for (const e of events) {
    if (!e.repeat_weekdays?.length) continue;
    const first = warsawDay(e.starts_at);
    const time = warsawTime(e.starts_at);
    const duration = e.ends_at ? new Date(e.ends_at).getTime() - new Date(e.starts_at).getTime() : null;
    const last = e.repeat_until && e.repeat_until < toDay ? e.repeat_until : toDay;
    for (let day = first > fromDay ? first : fromDay; day <= last; day = addDays(day, 1)) {
      if (!e.repeat_weekdays.includes(isoWeekday(day))) continue;
      const closed = closures.some(
        (c) => c.status === "active" && day >= c.date_from && day <= c.date_to && (c.group_id == null || c.group_id === e.group_id),
      );
      if (closed) continue;
      const start = warsawInstant(day, time);
      out.push({
        ...e,
        starts_at: start.toISOString(),
        ends_at: duration == null ? null : new Date(start.getTime() + duration).toISOString(),
        occurrence_day: day,
      });
    }
  }
  return out;
}

/** One-off events and occurrences of recurring ones, by start. */
export function withOccurrences(oneOff: EventItem[], recurring: EventItem[], closures: Closure[], fromDay: string, toDay: string): EventItem[] {
  return [...oneOff, ...expandRecurring(recurring, closures, fromDay, toDay)].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

/** Stable React key: an occurrence of a recurring event is unique per day. */
export function eventKey(e: EventItem): string {
  return e.occurrence_day ? `${e.id}:${e.occurrence_day}` : e.id;
}

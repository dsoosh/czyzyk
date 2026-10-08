import { addDays, shortDate, warsawDay, warsawTime, weekday, WEEKDAYS_SHORT } from "./dates";
import type { Closure, EventItem } from "./items";

/** A calendar entry with the local days it covers, inclusive (school-calendar). */
export interface Span<T> {
  item: T;
  from: string;
  to: string;
}

/** Last local day of an event; a timed event ending exactly at midnight ends the day before. */
export function lastDay(e: Pick<EventItem, "starts_at" | "ends_at" | "all_day">): string {
  const first = warsawDay(e.starts_at);
  if (!e.ends_at) return first;
  let last = warsawDay(e.ends_at);
  if (!e.all_day && last > first && warsawTime(e.ends_at) === "00:00") last = addDays(last, -1);
  return last > first ? last : first;
}

/** True when nothing but a weekend lies between two days (`next` may also overlap `prev`). */
function follows(prevTo: string, nextFrom: string): boolean {
  for (let d = addDays(prevTo, 1); d < nextFrom; d = addDays(d, 1)) {
    const w = weekday(d);
    if (w !== 0 && w !== 6) return false;
  }
  return true;
}

/** "Zielona szkoła – dzień 2" and "zielona szkoła (1/3)" name the same thing. */
export function sameName(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s*\(\s*\d+\s*\/\s*\d+\s*\)\s*$/, "")
    .replace(/[\s,–—-]*\(?\s*(dzień|dz\.)\s*\d+\s*\)?\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Joins spans with the same key on consecutive days (a weekend gap is fine) into one. */
function merge<T>(spans: Span<T>[], key: (item: T) => string | null): Span<T>[] {
  const sorted = [...spans].sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
  const out: Span<T>[] = [];
  const open = new Map<string, Span<T>>();
  for (const span of sorted) {
    const k = key(span.item);
    const prev = k == null ? undefined : open.get(k);
    if (prev && follows(prev.to, span.from)) {
      if (span.to > prev.to) prev.to = span.to;
      continue;
    }
    const copy = { ...span };
    out.push(copy);
    if (k != null) open.set(k, copy);
  }
  return out;
}

/** Closures as spans; consecutive ones of the same group and reason become one. */
export function closureSpans(closures: Closure[]): Span<Closure>[] {
  return merge(
    closures.map((c) => ({ item: c, from: c.date_from, to: c.date_to })),
    (c) => `${c.group_id ?? ""}|${sameName(c.reason ?? "")}`,
  );
}

/**
 * Events as spans. A one-off event covers its days from start to end; consecutive one-off
 * all-day events of the same group and name become one span, led by the first event.
 * Occurrences of recurring events stay one day each.
 */
export function eventSpans(events: EventItem[]): Span<EventItem>[] {
  return merge(
    events.map((e) => ({ item: e, from: e.occurrence_day ?? warsawDay(e.starts_at), to: e.occurrence_day ?? lastDay(e) })),
    (e) => (e.occurrence_day || e.repeat_weekdays?.length || !e.all_day ? null : `${e.group_id ?? ""}|${sameName(e.title)}`),
  ).sort((a, b) => a.from.localeCompare(b.from) || a.item.starts_at.localeCompare(b.item.starts_at));
}

/** "pn 12.10 – śr 14.10"; null for a one-day span. */
export function rangeLabel(span: Pick<Span<unknown>, "from" | "to">): string | null {
  if (span.from === span.to) return null;
  const day = (d: string) => `${WEEKDAYS_SHORT[weekday(d)]} ${shortDate(d)}`;
  return `${day(span.from)} – ${day(span.to)}`;
}

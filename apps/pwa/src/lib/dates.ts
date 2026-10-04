/** Calendar helpers in Europe/Warsaw, without a date library. Days are "YYYY-MM-DD" strings. */

export const TIME_ZONE = "Europe/Warsaw";

const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const timeFmt = new Intl.DateTimeFormat("pl-PL", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
const partsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

const WEEKDAYS_SHORT = ["nd", "pn", "wt", "śr", "czw", "pt", "sob"];
const WEEKDAYS_LONG = ["Niedziela", "Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota"];
export const MONTHS = [
  "styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec",
  "lipiec", "sierpień", "wrzesień", "październik", "listopad", "grudzień",
];

/** Day of an instant in Warsaw. */
export function warsawDay(instant: Date | string): string {
  return dayFmt.format(typeof instant === "string" ? new Date(instant) : instant);
}

export function warsawTime(instant: Date | string): string {
  return timeFmt.format(typeof instant === "string" ? new Date(instant) : instant);
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function weekday(day: string): number {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Offset of Warsaw from UTC (in ms) at the given instant. */
function offsetAt(instant: number): number {
  const p = Object.fromEntries(partsFmt.formatToParts(new Date(instant)).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
  return asUtc - (instant - (instant % 1000));
}

/** UTC instant of local midnight starting `day` in Warsaw (DST aware). */
export function startOfWarsawDay(day: string): Date {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const guess = Date.UTC(y, m - 1, d);
  const first = guess - offsetAt(guess);
  return new Date(guess - offsetAt(first));
}

/** "9.10" */
export function shortDate(day: string): string {
  const [, m, d] = day.split("-").map(Number);
  return `${d}.${String(m).padStart(2, "0")}`;
}

/** "dziś", "jutro", "wczoraj" or "pt 9.10". */
export function dayLabel(day: string, today: string): string {
  if (day === today) return "dziś";
  if (day === addDays(today, 1)) return "jutro";
  if (day === addDays(today, -1)) return "wczoraj";
  return `${WEEKDAYS_SHORT[weekday(day)]} ${shortDate(day)}`;
}

/** "Poniedziałek 12.10" */
export function longDayLabel(day: string): string {
  return `${WEEKDAYS_LONG[weekday(day)]} ${shortDate(day)}`;
}

export function monthTitle(month: string): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return `${MONTHS[m - 1]} ${y}`;
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

/** Weeks (Monday first) covering the month; days outside the month are null. */
export function monthGrid(month: string): (string | null)[][] {
  const first = `${month}-01`;
  const lead = (weekday(first) + 6) % 7;
  const days: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let day = first; day.startsWith(month); day = addDays(day, 1)) days.push(day);
  while (days.length % 7) days.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

/** Days from `from` to `to` inclusive. */
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

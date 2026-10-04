export const TIME_ZONE = "Europe/Warsaw";

const dateFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const weekdayFmt = new Intl.DateTimeFormat("pl-PL", { timeZone: TIME_ZONE, weekday: "long" });
const shortWeekdayFmt = new Intl.DateTimeFormat("pl-PL", { timeZone: TIME_ZONE, weekday: "short" });

/** YYYY-MM-DD of `date` in Europe/Warsaw. */
export function warsawDate(date: Date): string {
  return dateFmt.format(date);
}

/** e.g. "śr 2026-10-07 18:02" */
export function warsawStamp(date: Date): string {
  return `${shortWeekdayFmt.format(date).replace(".", "")} ${warsawDate(date)} ${timeFmt.format(date)}`;
}

/** e.g. "środa, 2026-10-07" */
export function warsawDayLong(date: Date): string {
  return `${weekdayFmt.format(date)}, ${warsawDate(date)}`;
}

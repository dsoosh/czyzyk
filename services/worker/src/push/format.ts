/** "12.10" from "2026-10-12". */
export function shortDate(day: string): string {
  const [, m, d] = day.split("-").map(Number);
  return `${d}.${String(m).padStart(2, "0")}`;
}

/** "12.10" or "23.12–1.01". */
export function dateRange(from: string, to: string): string {
  return from === to ? shortDate(from) : `${shortDate(from)}–${shortDate(to)}`;
}

/** "10 zł", "25,50 zł". */
export function formatAmount(amount: number | string): string {
  const n = Number(amount);
  return `${n.toLocaleString("pl-PL", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })} zł`;
}

/** Payment label: the amount is added unless the description already names it. */
export function paymentLabel(description: string, amount: number | string | null): string {
  if (amount == null || /zł|pln/i.test(description)) return description;
  return `${description} (${formatAmount(amount)})`;
}

/** Push bodies stay short: push services and lock screens cut long text anyway. */
export function truncate(text: string, max = 180): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

export interface DropOff {
  place: string;
  from: string | null;
  until: string | null;
}

/** "Baza od 8:30 do 8:45" (event-plan). */
export function dropOffLabel(d: DropOff): string {
  const hour = (t: string) => t.replace(/^0(\d)/, "$1");
  return [d.place, d.from ? `od ${hour(d.from)}` : null, d.until ? `do ${hour(d.until)}` : null].filter(Boolean).join(" ");
}

/**
 * "Wycieczka 08:00 (ZOO; zbiórka: dworzec PKP)": an event in a digest, with its places when known
 * (event-location); where to bring the child replaces the meeting point when known (event-plan).
 */
export function eventLabel(e: {
  title: string;
  all_day: boolean;
  time: string;
  location: string | null;
  meeting_point?: string | null;
  drop_offs?: DropOff[] | null;
}): string {
  const label = e.all_day ? e.title : `${e.title} ${e.time}`;
  const bring = e.drop_offs?.length
    ? `przyprowadzenie: ${e.drop_offs.map(dropOffLabel).join(" albo ")}`
    : e.meeting_point
      ? `zbiórka: ${e.meeting_point}`
      : null;
  const places = [e.location, bring].filter(Boolean);
  return places.length ? `${label} (${places.join("; ")})` : label;
}

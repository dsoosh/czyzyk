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

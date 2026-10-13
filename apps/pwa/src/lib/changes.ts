import { shortDate } from "./dates";
import { dropOffLabel, formatAmount, type DropOff, type ItemChange, type ScheduleStep } from "./items";

/** How the family reads the fields of an item change (item-history). */
export const FIELD_LABELS: Record<string, string> = {
  title: "Nazwa",
  start: "Początek",
  end: "Koniec",
  all_day: "Cały dzień",
  location: "Miejsce",
  meeting_point: "Zbiórka",
  drop_offs: "Przyprowadzenie",
  schedule: "Plan dnia",
  whole_kindergarten: "Całe przedszkole",
  description: "Opis",
  due_date: "Termin",
  amount_pln: "Kwota",
  question: "Pytanie",
  date_from: "Od",
  date_to: "Do",
  reason: "Powód",
  category: "Kategoria",
  label: "Nazwa",
  value: "Wartość",
  children: "Dzieci",
};

export const OP_LABELS: Record<ItemChange["op"], string> = { create: "Utworzono", update: "Zmieniono", cancel: "Odwołano" };

/** A stored value as the family reads it: dates and times in Polish, yes/no, amounts. */
export function formatValue(field: string, value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "tak" : "nie";
  if (field === "drop_offs" && Array.isArray(value)) return value.length ? (value as DropOff[]).map(dropOffLabel).join("; ") : "—";
  if (field === "schedule" && Array.isArray(value)) {
    return value.length ? (value as ScheduleStep[]).map((s) => `${s.time}${s.end ? `–${s.end}` : ""} ${s.label}`).join("; ") : "—";
  }
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  if (field === "amount_pln") return formatAmount(value as number);
  if (typeof value === "string") {
    const m = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?$/.exec(value);
    if (m) return m[2] ? `${shortDate(m[1]!)} ${m[2]}` : shortDate(m[1]!);
  }
  return String(value);
}

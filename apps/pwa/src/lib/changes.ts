import { shortDate } from "./dates";
import { formatAmount, type ItemChange } from "./items";

/** How the family reads the fields of an item change (item-history). */
export const FIELD_LABELS: Record<string, string> = {
  title: "Nazwa",
  start: "Początek",
  end: "Koniec",
  all_day: "Cały dzień",
  location: "Miejsce",
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
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  if (field === "amount_pln") return formatAmount(value as number);
  if (typeof value === "string") {
    const m = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?$/.exec(value);
    if (m) return m[2] ? `${shortDate(m[1]!)} ${m[2]}` : shortDate(m[1]!);
  }
  return String(value);
}

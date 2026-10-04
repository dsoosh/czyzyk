import { itemDataSchemas, type ItemType } from "@czyzyk/shared/extraction";
import { run } from "./items";
import type { Db } from "./supabase";

export type ReviewAction = "approve" | "reject" | "dismiss";

export interface Proposal {
  op: "update" | "cancel";
  data?: Record<string, unknown>;
  confidence?: number;
  rationale?: string;
}

export interface QueueItem {
  kind: ItemType;
  id: string;
  group_id: string | null;
  status: "active" | "needs_review" | "cancelled";
  confidence: number | null;
  rationale: string | null;
  source_message_ids: string[];
  pending_patch: Proposal | null;
  reviewed_at: string | null;
  updated_at: string;
  /** Current values, with the same field names as extraction data. */
  data: Record<string, unknown>;
}

export const KIND_LABELS: Record<ItemType, string> = {
  event: "Wydarzenie",
  bring_item: "Do przyniesienia",
  payment: "Płatność",
  action_required: "Wymaga odpowiedzi",
  closure: "Dzień wolny",
  fact: "Ściągawka",
};

export async function fetchReviewQueue(db: Db): Promise<QueueItem[]> {
  return run<QueueItem[]>(db.from("review_queue").select("*").order("updated_at", { ascending: false }).limit(200));
}

export async function fetchReviewCount(db: Db): Promise<number> {
  return (await run<{ id: string }[]>(db.from("review_queue").select("id").limit(200))).length;
}

export async function reviewItem(
  db: Db,
  kind: ItemType,
  id: string,
  action: ReviewAction,
  patch?: Record<string, unknown>,
): Promise<void> {
  const { error } = await db.rpc("review_item", { p_kind: kind, p_id: id, p_action: action, p_patch: patch ?? null });
  if (error) throw new Error(error.message);
}

export type FieldKind = "text" | "date" | "datetime" | "money" | "bool" | "category";

export interface Field {
  name: string;
  label: string;
  type: FieldKind;
  optional?: boolean;
}

export const FIELDS: Record<ItemType, Field[]> = {
  event: [
    { name: "title", label: "Tytuł", type: "text" },
    { name: "all_day", label: "Cały dzień", type: "bool" },
    { name: "start", label: "Początek", type: "datetime" },
    { name: "end", label: "Koniec", type: "datetime", optional: true },
    { name: "location", label: "Miejsce", type: "text", optional: true },
    { name: "whole_kindergarten", label: "Całe przedszkole", type: "bool" },
  ],
  bring_item: [
    { name: "description", label: "Co przynieść", type: "text" },
    { name: "due_date", label: "Na kiedy", type: "date", optional: true },
  ],
  payment: [
    { name: "description", label: "Za co", type: "text" },
    { name: "amount_pln", label: "Kwota (zł)", type: "money", optional: true },
    { name: "due_date", label: "Termin", type: "date", optional: true },
  ],
  action_required: [
    { name: "question", label: "Sprawa", type: "text" },
    { name: "due_date", label: "Termin", type: "date", optional: true },
  ],
  closure: [
    { name: "date_from", label: "Od", type: "date" },
    { name: "date_to", label: "Do", type: "date" },
    { name: "reason", label: "Powód", type: "text", optional: true },
  ],
  fact: [
    { name: "category", label: "Kategoria", type: "category" },
    { name: "label", label: "Nazwa", type: "text" },
    { name: "value", label: "Wartość", type: "text" },
  ],
};

export type FormValues = Record<string, string | boolean>;

export function toFormValues(kind: ItemType, data: Record<string, unknown>): FormValues {
  return Object.fromEntries(
    FIELDS[kind].map((f) => {
      const v = data[f.name];
      if (f.type === "bool") return [f.name, v === true];
      return [f.name, v == null ? "" : String(v)];
    }),
  );
}

/**
 * Turns form values into item data and validates them with the same zod schema the
 * worker uses for model output. Returns Polish error messages keyed by field.
 */
export function parseForm(
  kind: ItemType,
  values: FormValues,
): { ok: true; data: Record<string, unknown> } | { ok: false; errors: Record<string, string> } {
  const data: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  for (const f of FIELDS[kind]) {
    const raw = values[f.name];
    if (f.type === "bool") {
      data[f.name] = raw === true;
      continue;
    }
    const text = String(raw ?? "").trim();
    if (text === "") {
      data[f.name] = f.optional ? null : "";
      continue;
    }
    if (f.type === "money") {
      const n = Number(text.replace(",", "."));
      if (!Number.isFinite(n)) errors[f.name] = "Podaj kwotę, np. 12,50";
      data[f.name] = n;
    } else if (f.type === "datetime" && values.all_day === true) {
      data[f.name] = text.slice(0, 10);
    } else {
      data[f.name] = text;
    }
  }

  const schema = kind === "bring_item" ? itemDataSchemas.bring_item.omit({ event: true }) : itemDataSchemas[kind];
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const name = String(issue.path[0] ?? "");
      const label = FIELDS[kind].find((f) => f.name === name)?.label ?? name;
      errors[name] ??= data[name] === "" ? `Pole „${label}” jest wymagane` : `Pole „${label}” ma niepoprawną wartość`;
    }
  }
  if (kind === "event" && data.end && String(data.end) < String(data.start)) errors.end ??= "Koniec nie może być przed początkiem";
  if (kind === "closure" && String(data.date_to) < String(data.date_from)) errors.date_to ??= "„Do” nie może być przed „Od”";
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, data: parsed.success ? (parsed.data as Record<string, unknown>) : data };
}

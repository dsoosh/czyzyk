import type { ActionSuggestionKind } from "@czyzyk/shared/extraction";
import { dayLabel, warsawDay } from "./dates";
import type { Db } from "./supabase";

/** Where an applied suggestion put the item, for the confirmation shown to the user. */
export const SUGGESTION_RESULT: Record<ActionSuggestionKind, string> = {
  bring: "Dodano do rzeczy do przyniesienia.",
  payment: "Dodano do płatności.",
  event: "Dodano do kalendarza.",
  answer: "Zapisano odpowiedź.",
  done: "Oznaczono jako załatwione.",
  not_applicable: "Oznaczono jako niedotyczące rodziny.",
};

export interface AppliedSuggestion {
  kind: ActionSuggestionKind;
  /** Date of the created thing to bring / payment / event, if any. */
  due_date: string | null;
}

/** Carries out suggestion `index` of an open item (apply_action_suggestion). */
export async function applySuggestion(db: Db, id: string, index: number): Promise<AppliedSuggestion> {
  const { data, error } = await db.rpc("apply_action_suggestion", { p_id: id, p_index: index });
  if (error) throw new Error(error.message);
  const result = data as { kind: ActionSuggestionKind; due_date?: string | null };
  return { kind: result.kind, due_date: result.due_date ?? null };
}

/** "Dodano do rzeczy do przyniesienia na jutro." – where the item went and for when. */
export function appliedMessage(applied: AppliedSuggestion, now = new Date()): string {
  const base = SUGGESTION_RESULT[applied.kind];
  if (!applied.due_date) return base;
  return `${base.slice(0, -1)} na ${dayLabel(applied.due_date, warsawDay(now))}.`;
}

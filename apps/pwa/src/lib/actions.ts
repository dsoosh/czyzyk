import type { ActionSuggestionKind } from "@czyzyk/shared/extraction";
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

/** Carries out suggestion `index` of an open item (apply_action_suggestion). */
export async function applySuggestion(db: Db, id: string, index: number): Promise<ActionSuggestionKind> {
  const { data, error } = await db.rpc("apply_action_suggestion", { p_id: id, p_index: index });
  if (error) throw new Error(error.message);
  return (data as { kind: ActionSuggestionKind }).kind;
}

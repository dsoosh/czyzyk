import { z } from "zod";

/** Lists the PWA shows under "Listy". */
export const ASSISTANT_LISTS = ["bring", "payments", "actions", "closures"] as const;
/** Item kinds that have a "skąd to wiem" view. */
export const ASSISTANT_ITEM_KINDS = ["event", "bring_item", "payment", "action_required", "closure", "fact"] as const;

/**
 * The screen a question was asked on. Only identifiers: the server loads the data
 * itself, so a client can never hand the model data that is not in the database.
 */
export const assistantViewSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("general") }).strict(),
  z.object({ kind: z.literal("today") }).strict(),
  z.object({ kind: z.literal("calendar"), month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) }).strict(),
  z.object({ kind: z.literal("event"), id: z.uuid() }).strict(),
  z.object({ kind: z.literal("list"), list: z.enum(ASSISTANT_LISTS) }).strict(),
  z.object({ kind: z.literal("group"), id: z.uuid() }).strict(),
  z.object({ kind: z.literal("source"), item_kind: z.enum(ASSISTANT_ITEM_KINDS), id: z.uuid() }).strict(),
]);
export type AssistantView = z.infer<typeof assistantViewSchema>;

export const ASSISTANT_MAX_QUESTION = 1000;
export const ASSISTANT_MAX_HISTORY = 10;

const turnSchema = z
  .object({
    role: z.enum(["user", "assistant"]),
    content: z.string().min(1).max(4000),
  })
  .strict();
export type AssistantTurn = z.infer<typeof turnSchema>;

export const assistantAskSchema = z
  .object({
    view: assistantViewSchema,
    question: z.string().trim().min(1).max(ASSISTANT_MAX_QUESTION),
    /** Earlier exchanges of this conversation, oldest first: user, assistant, user, assistant… */
    history: z
      .array(turnSchema)
      .max(ASSISTANT_MAX_HISTORY * 2)
      .default([])
      .refine((turns) => turns.length % 2 === 0 && turns.every((t, i) => t.role === (i % 2 === 0 ? "user" : "assistant")), {
        message: "history must alternate user/assistant and end with an answer",
      }),
  })
  .strict();
export type AssistantAsk = z.input<typeof assistantAskSchema>;

export interface AssistantAnswer {
  answer: string;
}

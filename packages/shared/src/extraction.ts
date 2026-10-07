import { z } from "zod";

/**
 * Contract between the extraction model and the server. The model refers to
 * messages and existing items by short aliases (W1…, E1…) and to items created
 * in the same answer by refs (nowe1…); the server maps them to ids.
 */

export const ITEM_TYPES = ["event", "bring_item", "payment", "action_required", "closure", "fact"] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export const FACT_CATEGORIES = ["godziny", "kontakt", "osoba", "inne"] as const;

const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");
const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/, "YYYY-MM-DD lub YYYY-MM-DDTHH:mm");
const itemRef = z.string().regex(/^(E\d+|nowe\d+)$/);

export const eventDataSchema = z
  .object({
    title: z.string().trim().min(1).max(200).describe("Krótki tytuł po polsku, np. „Bal jesienny”"),
    start: localDateTime.describe("Początek w czasie Europe/Warsaw: YYYY-MM-DD (cały dzień) lub YYYY-MM-DDTHH:mm"),
    end: localDateTime.nullable().describe("Koniec albo null"),
    all_day: z.boolean(),
    location: z.string().trim().max(200).nullable(),
    whole_kindergarten: z.boolean().describe("true, gdy dotyczy całego przedszkola, a nie tylko tej grupy"),
    repeat: z
      .object({
        weekdays: z
          .array(z.number().int().min(1).max(7))
          .min(1)
          .max(7)
          .describe("Dni tygodnia: 1 = poniedziałek … 7 = niedziela"),
        until: localDate.nullable().describe("Ostatni dzień powtarzania albo null (do odwołania)"),
      })
      .strict()
      .nullable()
      .optional()
      .describe("Tylko dla stałych zajęć w określone dni tygodnia (np. basen w każdy wtorek); inaczej null"),
  })
  .strict();

export const bringItemDataSchema = z
  .object({
    description: z.string().trim().min(1).max(200).describe("Co przynieść, np. „przebranie”"),
    due_date: localDate.nullable().describe("Dzień, na który przynieść"),
    event: itemRef.nullable().describe("Alias wydarzenia (E…) lub ref tworzonego wydarzenia (nowe…), albo null"),
  })
  .strict();

export const paymentDataSchema = z
  .object({
    description: z.string().trim().min(1).max(200),
    amount_pln: z.number().nonnegative().nullable(),
    due_date: localDate.nullable(),
  })
  .strict();

/**
 * What a family member can do with a "wymaga odpowiedzi" item (action-suggestions). The model
 * proposes the kinds that fit the item; the database carries them out (apply_action_suggestion).
 */
export const ACTION_SUGGESTION_KINDS = ["bring", "payment", "event", "answer", "done", "not_applicable"] as const;
export type ActionSuggestionKind = (typeof ACTION_SUGGESTION_KINDS)[number];

export const actionSuggestionSchema = z
  .object({
    kind: z
      .enum(ACTION_SUGGESTION_KINDS)
      .describe(
        "bring – przenieś do rzeczy do przyniesienia; payment – do płatności; event – do kalendarza; answer – odpowiedź rodziny (np. „Tak, zapisujemy”, „Nie”); done – zrobione; not_applicable – nie dotyczy",
      ),
    label: z.string().trim().min(1).max(40).describe("Krótki napis na przycisku, np. „Do przyniesienia”, „Tak, zapisujemy”"),
    description: z.string().trim().min(1).max(200).nullable().describe("Dla bring/payment/event: co przynieść, za co zapłacić, nazwa wydarzenia"),
    due_date: localDate.nullable().describe("Dla bring/payment/event: dzień (gdy inny niż termin sprawy)"),
    amount_pln: z.number().nonnegative().nullable().describe("Dla payment: kwota w złotych"),
  })
  .strict();
export type ActionSuggestion = z.infer<typeof actionSuggestionSchema>;

export const actionRequiredDataSchema = z
  .object({
    question: z.string().trim().min(1).max(300).describe("Na co rodzice muszą odpowiedzieć lub co załatwić"),
    due_date: localDate.nullable(),
    // Optional, not defaulted: an update without it keeps the stored suggestions.
    suggestions: z
      .array(actionSuggestionSchema)
      .max(4)
      .optional()
      .describe("1–4 proponowane akcje dopasowane do sprawy, od najbardziej prawdopodobnej"),
  })
  .strict();

export const closureDataSchema = z
  .object({
    date_from: localDate,
    date_to: localDate,
    reason: z.string().trim().max(200).nullable(),
  })
  .strict();

export const factDataSchema = z
  .object({
    category: z.enum(FACT_CATEGORIES),
    label: z.string().trim().min(1).max(100),
    value: z.string().trim().min(1).max(300),
  })
  .strict();

export const itemDataSchemas = {
  event: eventDataSchema,
  bring_item: bringItemDataSchema,
  payment: paymentDataSchema,
  action_required: actionRequiredDataSchema,
  closure: closureDataSchema,
  fact: factDataSchema,
} as const;

export type ItemData = { [K in ItemType]: z.infer<(typeof itemDataSchemas)[K]> };

const baseOperation = {
  type: z.enum(ITEM_TYPES),
  source_messages: z.array(z.string().regex(/^W\d+$/)).min(1).describe("Aliasy wiadomości źródłowych (W…)"),
  confidence: z.number().min(0).max(1).describe("Pewność 0–1"),
  rationale: z.string().trim().min(1).max(500).describe("Krótkie uzasadnienie po polsku"),
};

const anyItemData = z.union([
  eventDataSchema,
  bringItemDataSchema,
  paymentDataSchema,
  actionRequiredDataSchema,
  closureDataSchema,
  factDataSchema,
]);

/** Item types that can be assigned to children of the family. */
export const CHILD_ITEM_TYPES = ["event", "bring_item", "payment", "action_required"] as const satisfies readonly ItemType[];

const childrenField = z
  .array(z.string().trim().min(1).max(60))
  .max(10)
  .default([])
  .describe("Imiona dzieci z listy <dzieci>, których dotyczy element; pusta lista, gdy dotyczy całej grupy");

/** Shape the model sees; per-type data is validated afterwards (see parseOperation). */
export const rawOperationSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("create"),
    ...baseOperation,
    // Optional: models often leave it out when nothing refers to the item (a payment next to a new event).
    ref: z.string().regex(/^nowe\d+$/).nullish().describe("Lokalny identyfikator do odwołań w tej samej odpowiedzi (tylko gdy coś się do niego odwołuje)"),
    data: anyItemData.describe("Pełne dane elementu zgodne z jego typem"),
    children: childrenField,
  }),
  z.object({
    op: z.literal("update"),
    ...baseOperation,
    target: z.string().regex(/^E\d+$/).describe("Alias istniejącego elementu"),
    data: z.record(z.string(), z.unknown()).describe("Tylko zmieniane pola, nazwy jak w danych typu"),
    children: childrenField.describe("Imiona dzieci z listy <dzieci>; pusta lista zostawia dotychczasowe przypisanie"),
  }),
  z.object({
    op: z.literal("cancel"),
    ...baseOperation,
    target: z.string().regex(/^E\d+$/),
  }),
]);
export type RawOperation = z.infer<typeof rawOperationSchema>;

export const extractionResultSchema = z.object({
  operations: z.array(z.unknown()).max(100),
});

export type ParsedOperation =
  | { op: "create"; type: ItemType; ref: string | null; data: ItemData[ItemType]; children: string[]; sourceMessages: string[]; confidence: number; rationale: string }
  | { op: "update"; type: ItemType; target: string; data: Partial<ItemData[ItemType]>; children: string[]; sourceMessages: string[]; confidence: number; rationale: string }
  | { op: "cancel"; type: ItemType; target: string; sourceMessages: string[]; confidence: number; rationale: string };

/** Validates one operation, including type-specific data (partial for updates). */
export function parseOperation(input: unknown): { ok: true; value: ParsedOperation } | { ok: false; error: string } {
  const raw = rawOperationSchema.safeParse(input);
  if (!raw.success) return { ok: false, error: formatIssues(raw.error) };
  const o = raw.data;
  const common = { type: o.type, sourceMessages: o.source_messages, confidence: o.confidence, rationale: o.rationale };
  if (o.op === "cancel") return { ok: true, value: { op: "cancel", target: o.target, ...common } };

  const schema = itemDataSchemas[o.type];
  if (o.op === "create") {
    const data = schema.safeParse(o.data);
    if (!data.success) return { ok: false, error: `data: ${formatIssues(data.error)}` };
    return { ok: true, value: { op: "create", ref: o.ref ?? null, data: data.data, children: o.children, ...common } };
  }
  const data = schema.partial().safeParse(o.data);
  if (!data.success) return { ok: false, error: `data: ${formatIssues(data.error)}` };
  if (Object.keys(data.data).length === 0 && o.children.length === 0) return { ok: false, error: "data: empty update" };
  return { ok: true, value: { op: "update", target: o.target, data: data.data, children: o.children, ...common } };
}

function formatIssues(error: z.ZodError): string {
  return error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
}

/** JSON schema of the extraction tool input, generated from the zod contract. */
export function extractionToolInputSchema(): Record<string, unknown> {
  const { $schema: _ignored, ...schema } = z.toJSONSchema(z.object({ operations: z.array(rawOperationSchema) }), {
    target: "draft-7",
  }) as Record<string, unknown>;
  return schema;
}

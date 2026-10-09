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

/** A place in the app the assistant may link to ("Zapytaj" app help). */
export interface AppPlace {
  path: string;
  label: string;
  /** What the family does there. */
  how: string;
  adminOnly?: boolean;
}

/** Screens and settings sections, with what can be done there; the only links the PWA renders. */
export const APP_PLACES: readonly AppPlace[] = [
  { path: "/", label: "Dziś", how: "plan na dziś i jutro: wydarzenia, rzeczy do przyniesienia, płatności; odhaczanie spakowanych rzeczy i zapłaconych płatności; zaproszenia do rodziny" },
  { path: "/listy", label: "Listy → Do przyniesienia", how: "wszystkie rzeczy do przyniesienia; odhaczenie „spakowane”" },
  { path: "/listy/platnosci", label: "Listy → Płatności", how: "płatności; oznaczenie „Zapłacone”" },
  { path: "/listy/sprawy", label: "Listy → Wymaga odpowiedzi", how: "sprawy do załatwienia; szybkie akcje (np. „Kupić i przynieść”, „Tak, zapisujemy”) i oznaczenie „Załatwione”" },
  { path: "/listy/dni-wolne", label: "Listy → Dni wolne", how: "dni, w które przedszkole lub grupa jest nieczynna" },
  { path: "/kalendarz", label: "Kalendarz", how: "wydarzenia i dni wolne w widoku miesiąca; stuknięcie w wydarzenie pokazuje szczegóły, miejsce, zbiórkę i wiadomości źródłowe" },
  { path: "/czaty", label: "Czaty", how: "historia wiadomości grup WhatsApp, wyszukiwanie w wiadomościach, szczegóły wiadomości i sprawy z niej utworzone" },
  { path: "/ustawienia#dzieci", label: "Ustawienia → Dzieci", how: "dodanie, zmiana i usunięcie dziecka: imię, inne formy imienia (zdrobnienia), grupa, kolor; od grupy dziecka zależy, które sprawy widzi rodzina" },
  { path: "/ustawienia?dziecko=nowe", label: "Ustawienia → Dzieci → Dodaj dziecko", how: "formularz nowego dziecka" },
  { path: "/ustawienia#rodzina", label: "Ustawienia → Moja rodzina", how: "członkowie rodziny; dodanie adresu Google drugiego rodzica lub opiekuna (osoba z innej rodziny dostaje zaproszenie), usunięcie członka, anulowanie zaproszenia" },
  { path: "/ustawienia#numer", label: "Ustawienia → Mój numer WhatsApp", how: "własny numer WhatsApp: wiadomości członka rodziny są wtedy rozpoznawane jako jego" },
  { path: "/ustawienia#powiadomienia", label: "Ustawienia → Powiadomienia", how: "włączenie powiadomień push na tym urządzeniu, poranny plan, wieczorny skrót na jutro i jego godzina, alerty" },
  { path: "/ustawienia#kalendarz", label: "Ustawienia → Mój kalendarz", how: "prywatny link do subskrypcji kalendarza w Google, Apple lub Outlook (wydarzenia i dni wolne)" },
  { path: "/admin", label: "Admin → Dostęp", how: "prośby o dostęp (akceptuj/odrzuć) i adresy z dostępem", adminOnly: true },
  { path: "/admin/urzadzenia", label: "Admin → Urządzenia", how: "telefony z Czyżyk Connect: parowanie i odłączanie", adminOnly: true },
  { path: "/admin/grupy", label: "Admin → Grupy", how: "grupy WhatsApp: „Śledź”, „Wspólna” (widoczna dla wszystkich rodzin), nazwy wyświetlane, dodanie grupy", adminOnly: true },
  { path: "/admin/przeglad", label: "Admin → Do przejrzenia", how: "elementy o niskiej pewności do zatwierdzenia lub poprawienia", adminOnly: true },
  { path: "/admin/import", label: "Admin → Import", how: "import eksportu czatu WhatsApp i ręczne wklejanie wiadomości", adminOnly: true },
  { path: "/admin/przedszkole", label: "Admin → Przedszkole", how: "opis przedszkola dla analizy i asystenta (miejsca, osoby, zwyczaje)", adminOnly: true },
  { path: "/admin/kontakty", label: "Admin → Kontakty", how: "role autorów wiadomości (ciocia, dyrekcja, rodzic)", adminOnly: true },
  { path: "/admin/prompty", label: "Admin → Prompty", how: "szablony promptów analizy i asystenta", adminOnly: true },
  { path: "/admin/llm", label: "Admin → Wywołania LLM", how: "dziennik wywołań modelu", adminOnly: true },
];

/** The app guide for the assistant's system prompt; admin places only for the operator. */
export function appGuide(admin: boolean): string {
  return APP_PLACES.filter((p) => admin || !p.adminOnly)
    .map((p) => `- [${p.label}](${p.path}): ${p.how}`)
    .join("\n");
}

/** Whether a link in an assistant answer points at a known place in the app. */
export function isAppPlace(path: string): boolean {
  return APP_PLACES.some((p) => p.path === path);
}

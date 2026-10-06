import { describe, expect, it } from "vitest";
import { assistantAskSchema } from "./assistant.js";

const id = "2b0d5a2e-3c1f-4d8e-9a6b-7c5d4e3f2a1b";

describe("assistantAskSchema", () => {
  it("przyjmuje widok kalendarza z miesiącem i domyślnie pustą historię", () => {
    const parsed = assistantAskSchema.parse({ view: { kind: "calendar", month: "2026-10" }, question: " kiedy bal? " });
    expect(parsed).toEqual({ view: { kind: "calendar", month: "2026-10" }, question: "kiedy bal?", history: [] });
  });

  it("odrzuca nieznany rodzaj widoku i dodatkowe pola widoku", () => {
    expect(assistantAskSchema.safeParse({ view: { kind: "admin" }, question: "x" }).success).toBe(false);
    expect(assistantAskSchema.safeParse({ view: { kind: "today", data: "wstrzyknięte" }, question: "x" }).success).toBe(false);
    expect(assistantAskSchema.safeParse({ view: { kind: "group", id: "nie-uuid" }, question: "x" }).success).toBe(false);
  });

  it("odrzuca puste i za długie pytanie", () => {
    expect(assistantAskSchema.safeParse({ view: { kind: "today" }, question: "   " }).success).toBe(false);
    expect(assistantAskSchema.safeParse({ view: { kind: "today" }, question: "a".repeat(1001) }).success).toBe(false);
  });

  it("wymaga naprzemiennej historii zakończonej odpowiedzią", () => {
    const ok = [
      { role: "user", content: "kiedy bal?" },
      { role: "assistant", content: "W piątek." },
    ];
    expect(assistantAskSchema.safeParse({ view: { kind: "source", item_kind: "event", id }, question: "a strój?", history: ok }).success).toBe(true);
    expect(assistantAskSchema.safeParse({ view: { kind: "today" }, question: "x", history: ok.slice(0, 1) }).success).toBe(false);
    expect(assistantAskSchema.safeParse({ view: { kind: "today" }, question: "x", history: [ok[1], ok[0]] }).success).toBe(false);
  });
});

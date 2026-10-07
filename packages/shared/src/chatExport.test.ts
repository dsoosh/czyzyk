import { describe, expect, it } from "vitest";
import { chatNameFromFileName, matchGroupByFileName, parseChatExport, warsawToUtc } from "./chatExport.js";

const LRM = "‎";

const ANDROID_PL = [
  "07.10.2026, 09:00 - Wiadomości i połączenia są szyfrowane end-to-end. Nikt spoza tego czatu nie może ich przeczytać.",
  "07.10.2026, 09:01 - Pani Ania dodała Mama Zosi",
  "07.10.2026, 18:02 - Pani Ania: W piątek bal jesienny!",
  "Prosimy o przebrania.",
  "Zbiórka o 9:00.",
  "07.10.2026, 18:05 - Mama Zosi: IMG-20261007-WA0003.jpg (plik załączony)",
  "Plan na październik",
  "07.10.2026, 18:06 - Tata Kuby: <Pominięto multimedia>",
  "07.10.2026, 18:07 - Tata Kuby: Ta wiadomość została usunięta",
  "07.10.2026, 18:08 - Pani Ania: Dziękuję: do zobaczenia <Ta wiadomość została zmieniona>",
  "13.10.2026, 07:30 - Pani Ania: Jutro wycieczka",
].join("\n");

const ANDROID_EN = [
  "10/9/26, 8:15 PM - Anna: See you",
  "10/9/26, 12:05 AM - Anna: Late night",
  "10/9/26, 12:30 PM - Anna: Noon",
  "10/9/26, 8:16 PM - Messages and calls are end-to-end encrypted.",
].join("\n");

const IOS_PL = [
  `[07.10.2026, 18:02:11] Motylki 2026/27: ${LRM}Wiadomości i połączenia są szyfrowane end-to-end.`,
  `[07.10.2026, 18:03:00] Pani Ania: Dzień dobry`,
  `${LRM}[07.10.2026, 18:04:05] Mama Zosi: ${LRM}<załączony: 00000012-PHOTO-2026-10-07-18-04-05.jpg>`,
  `[07.10.2026, 18:05:00] Motylki 2026/27: ${LRM}Pani Ania dodała Tata Kuby`,
  `[07.10.2026, 18:06:00] Tata Kuby: ${LRM}obraz pominięty`,
].join("\r\n");

describe("parseChatExport", () => {
  it("Android PL: wieloliniowe, systemowe, usunięte, załączniki z podpisem", () => {
    const { messages, skipped } = parseChatExport(ANDROID_PL);
    expect(messages.map((m) => [m.author, m.localTime, m.text, m.hasAttachment])).toEqual([
      ["Pani Ania", "2026-10-07T18:02:00", "W piątek bal jesienny!\nProsimy o przebrania.\nZbiórka o 9:00.", false],
      ["Mama Zosi", "2026-10-07T18:05:00", "Plan na październik", true],
      ["Tata Kuby", "2026-10-07T18:06:00", "", true],
      ["Pani Ania", "2026-10-07T18:08:00", "Dziękuję: do zobaczenia", false],
      ["Pani Ania", "2026-10-13T07:30:00", "Jutro wycieczka", false],
    ]);
    expect(skipped).toBe(3);
    // CEST: 18:02 in Warsaw is 16:02 UTC.
    expect(messages[0]!.sentAt.toISOString()).toBe("2026-10-07T16:02:00.000Z");
  });

  it("Android EN 12-godzinny: 10/9/26, 8:15 PM to 9 października, 20:15", () => {
    const { messages, skipped } = parseChatExport(ANDROID_EN);
    expect(messages.map((m) => m.localTime)).toEqual(["2026-10-09T20:15:00", "2026-10-09T00:05:00", "2026-10-09T12:30:00"]);
    expect(messages[0]!.sentAt.toISOString()).toBe("2026-10-09T18:15:00.000Z");
    expect(skipped).toBe(1);
  });

  it("iOS PL: sekundy, systemowe z nazwą grupy, załączniki", () => {
    const { messages, skipped } = parseChatExport(IOS_PL);
    expect(messages.map((m) => [m.author, m.localTime, m.text, m.hasAttachment])).toEqual([
      ["Pani Ania", "2026-10-07T18:03:00", "Dzień dobry", false],
      ["Mama Zosi", "2026-10-07T18:04:05", "", true],
      ["Tata Kuby", "2026-10-07T18:06:00", "", true],
    ]);
    expect(skipped).toBe(2);
  });

  it("dzień pierwszy, gdy plik to rozstrzyga (25/12/26)", () => {
    const { messages } = parseChatExport("1/2/26, 10:00 - A: x\n25/12/26, 10:00 - A: y");
    expect(messages.map((m) => m.localTime.slice(0, 10))).toEqual(["2026-02-01", "2026-12-25"]);
  });

  it("zimą przesunięcie +1 h, plik bez rozpoznanych wiadomości daje pustą listę", () => {
    expect(parseChatExport("05.01.2027, 10:00 - A: zima").messages[0]!.sentAt.toISOString()).toBe("2027-01-05T09:00:00.000Z");
    expect(parseChatExport("to nie jest eksport\nani trochę").messages).toEqual([]);
  });
});

describe("warsawToUtc", () => {
  it("obsługuje zmianę czasu", () => {
    expect(warsawToUtc(2026, 10, 25, 1, 30).toISOString()).toBe("2026-10-24T23:30:00.000Z");
    expect(warsawToUtc(2026, 10, 25, 4, 0).toISOString()).toBe("2026-10-25T03:00:00.000Z");
  });
});

describe("nazwa pliku", () => {
  const groups = [
    { id: "g1", wa_name: "Motylki 2026/27", display_name: "Motylki" },
    { id: "g2", wa_name: "Rada rodziców", display_name: null },
  ];

  it("odczytuje nazwę czatu z nazw plików PL i EN", () => {
    expect(chatNameFromFileName("WhatsApp Chat with Motylki 2026_27.zip")).toBe("Motylki 2026_27");
    expect(chatNameFromFileName("Czat WhatsApp z Rada rodziców (1).txt")).toBe("Rada rodziców");
    expect(chatNameFromFileName("WhatsApp Chat - Motylki.zip")).toBe("Motylki");
    expect(chatNameFromFileName("_chat.txt")).toBeNull();
  });

  it("dopasowuje grupę po nazwie WhatsApp (także z „_” zamiast „/”) lub wyświetlanej", () => {
    expect(matchGroupByFileName("WhatsApp Chat with Motylki 2026_27.zip", groups)?.id).toBe("g1");
    expect(matchGroupByFileName("WhatsApp Chat - Motylki.zip", groups)?.id).toBe("g1");
    expect(matchGroupByFileName("Czat WhatsApp z Rada rodziców.txt", groups)?.id).toBe("g2");
    expect(matchGroupByFileName("WhatsApp Chat with Sąsiedzi.zip", groups)).toBeNull();
  });
});

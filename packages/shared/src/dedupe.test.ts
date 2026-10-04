import { describe, expect, it } from "vitest";
import { dedupeKey, normalizeText } from "./dedupe.js";

describe("normalizeText", () => {
  it("collapses whitespace, lower-cases and trims", () => {
    expect(normalizeText("  W piątek\n\tBAL,   przebrania ")).toBe("w piątek bal, przebrania");
  });

  it("unifies Unicode composition (NFC)", () => {
    // "Zażółć" written with combining marks must equal the precomposed form.
    expect(normalizeText("Zaz\u0307o\u0301\u0142c\u0301")).toBe("za\u017c\u00f3\u0142\u0107");
    expect(normalizeText("e\u0301")).toBe("\u00e9");
  });
});

describe("dedupeKey", () => {
  const base = { groupId: "g1", author: "Pani Ania", text: "W piątek bal", sentAt: new Date("2026-10-07T16:02:05Z") };

  it("is stable within the same minute and across whitespace/case differences", () => {
    expect(dedupeKey(base)).toBe(
      dedupeKey({ ...base, author: " pani  ania", text: "w  piątek BAL\n", sentAt: new Date("2026-10-07T16:02:59.999Z") }),
    );
  });

  it("differs for another minute, author, group or text", () => {
    const k = dedupeKey(base);
    expect(dedupeKey({ ...base, sentAt: new Date("2026-10-07T16:03:00Z") })).not.toBe(k);
    expect(dedupeKey({ ...base, author: "Mama Zosi" })).not.toBe(k);
    expect(dedupeKey({ ...base, groupId: "g2" })).not.toBe(k);
    expect(dedupeKey({ ...base, text: "W sobotę bal" })).not.toBe(k);
  });

  it("does not depend on the timezone offset of the input", () => {
    expect(dedupeKey(base)).toBe(dedupeKey({ ...base, sentAt: new Date("2026-10-07T18:02:30+02:00") }));
  });
});

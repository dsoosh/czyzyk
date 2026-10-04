import { describe, expect, it } from "vitest";
import { escapeText, foldLine, renderCalendar } from "./ics.js";

describe("escapeText", () => {
  it("escapes backslash, semicolon, comma and newlines", () => {
    expect(escapeText("a\\b;c,d\ne")).toBe("a\\\\b\\;c\\,d\\ne");
  });
});

describe("foldLine", () => {
  it("leaves short lines intact", () => {
    expect(foldLine("SUMMARY:Bal")).toBe("SUMMARY:Bal");
  });

  it("folds at 75 octets without splitting multi-byte characters", () => {
    const line = `SUMMARY:${"żółć".repeat(30)}`;
    const folded = foldLine(line);
    const parts = folded.split("\r\n");
    expect(parts.length).toBeGreaterThan(1);
    for (const [i, p] of parts.entries()) {
      expect(Buffer.byteLength(p, "utf8")).toBeLessThanOrEqual(75);
      if (i > 0) expect(p.startsWith(" ")).toBe(true);
    }
    expect(parts.map((p, i) => (i ? p.slice(1) : p)).join("")).toBe(line);
  });
});

describe("renderCalendar", () => {
  it("all-day and timed events (snapshot)", () => {
    const ics = renderCalendar(
      [
        {
          uid: "11111111-1111-1111-1111-111111111111@czyzyk",
          stamp: new Date("2026-10-07T16:05:00Z"),
          summary: "Bal jesienny",
          description: "Grupa: Motylki",
          location: null,
          start: "20261009",
          end: "20261010",
          allDay: true,
        },
        {
          uid: "22222222-2222-2222-2222-222222222222@czyzyk",
          stamp: new Date("2026-10-07T16:05:00Z"),
          summary: "Teatrzyk „Calineczka”, sala gimnastyczna; wejście od podwórka",
          description: "Całe przedszkole",
          location: "Sala gimnastyczna",
          start: "20261016T100000",
          end: "20261016T110000",
          allDay: false,
        },
      ],
      "Czyżyk – przedszkole",
    );
    expect(ics.split("\r\n").every((l) => Buffer.byteLength(l, "utf8") <= 75)).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toMatchSnapshot();
  });
});

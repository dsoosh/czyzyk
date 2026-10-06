import { describe, expect, it } from "vitest";
import { normalizeGroupName, notificationIngestSchema, seenGroupsSchema } from "./ingest.js";

describe("normalizeGroupName", () => {
  it("usuwa niewidoczne znaki kierunku tekstu i zwija spacje", () => {
    expect(normalizeGroupName("⁨SOKOŁY - Cztery Żywioły⁩")).toBe("SOKOŁY - Cztery Żywioły");
    expect(normalizeGroupName("  SOKOŁY  -​  Cztery Żywioły ")).toBe("SOKOŁY - Cztery Żywioły");
    expect(normalizeGroupName("‎Kotki﻿")).toBe("Kotki");
  });

  it("sprowadza polskie litery do postaci NFC, zachowuje wielkość liter i emoji", () => {
    const decomposed = "Żywioły".normalize("NFD");
    expect(normalizeGroupName(decomposed)).toBe("Żywioły");
    expect(normalizeGroupName("Sowy 🦉")).toBe("Sowy 🦉");
  });

  it("schematy ingestu zapisują postać znormalizowaną i odrzucają pustą", () => {
    const base = {
      idempotency_key: "2b0d5a2e-3c1f-4d8e-9a6b-7c5d4e3f2a1b",
      author: "Pani Ania",
      text: "x",
      sent_at: "2026-10-07T18:02:00+02:00",
      wa_package: "com.whatsapp",
    };
    expect(notificationIngestSchema.parse({ ...base, group_name: "⁨Motylki⁩" }).group_name).toBe("Motylki");
    expect(notificationIngestSchema.safeParse({ ...base, group_name: "⁨⁩ " }).success).toBe(false);
    expect(seenGroupsSchema.parse({ names: ["⁨Kotki⁩", "Lisy"] }).names).toEqual(["Kotki", "Lisy"]);
  });
});

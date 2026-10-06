import { describe, expect, it } from "vitest";
import { loadWorkerConfig } from "../config.js";
import { pushConfig } from "./config.js";
import { dateRange, formatAmount, paymentLabel, truncate } from "./format.js";

describe("format", () => {
  it("daty i kwoty po polsku", () => {
    expect(dateRange("2026-10-12", "2026-10-12")).toBe("12.10");
    expect(dateRange("2026-12-23", "2027-01-01")).toBe("23.12–1.01");
    expect(formatAmount(10)).toBe("10 zł");
    expect(formatAmount("25.5")).toBe("25,50 zł");
  });

  it("kwota dopisywana, gdy opis jej nie zawiera", () => {
    expect(paymentLabel("basen", 12)).toBe("basen (12 zł)");
    expect(paymentLabel("10 zł na teatrzyk", 10)).toBe("10 zł na teatrzyk");
    expect(paymentLabel("wyprawka", null)).toBe("wyprawka");
  });

  it("skraca długie treści", () => {
    expect(truncate("a".repeat(200))).toHaveLength(180);
    expect(truncate("krótko")).toBe("krótko");
  });
});

describe("pushConfig", () => {
  const base = {
    DATABASE_URL: "postgres://u:p@localhost/db",
    ANTHROPIC_API_KEY: "k",
    EXTRACTION_MODEL: "m",
    VAPID_PUBLIC_KEY: "B".repeat(87),
    VAPID_PRIVATE_KEY: "k".repeat(43),
    VAPID_SUBJECT: "mailto:rodzina@example.com",
  };

  it("push działa przy pełnej parze VAPID i poprawnym subject", () => {
    expect(pushConfig(loadWorkerConfig(base))).toMatchObject({ VAPID_SUBJECT: "mailto:rodzina@example.com", DIGEST_WINDOW_MINUTES: 120 });
    expect(() => loadWorkerConfig({ ...base, VAPID_SUBJECT: "rodzina@example.com" })).toThrow(/VAPID_SUBJECT/);
  });

  it("bez kluczy VAPID worker startuje, a push jest wyłączony", () => {
    const { VAPID_PUBLIC_KEY: _p, VAPID_PRIVATE_KEY: _k, VAPID_SUBJECT: _s, ...withoutPush } = base;
    expect(pushConfig(loadWorkerConfig(withoutPush))).toBeNull();
    expect(pushConfig(loadWorkerConfig({ ...withoutPush, VAPID_PUBLIC_KEY: base.VAPID_PUBLIC_KEY }))).toBeNull();
  });
});

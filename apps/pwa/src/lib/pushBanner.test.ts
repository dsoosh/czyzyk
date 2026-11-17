import { beforeEach, describe, expect, it } from "vitest";
import { dismissPushBanner, isPushBannerDismissed } from "./push";

beforeEach(() => localStorage.clear());

describe("odłożenie banera powiadomień", () => {
  it("chowa baner na 30 dni", () => {
    dismissPushBanner(new Date("2026-11-01T10:00:00Z"));
    expect(isPushBannerDismissed(new Date("2026-11-30T23:59:00Z"))).toBe(true);
    expect(isPushBannerDismissed(new Date("2026-12-01T10:00:01Z"))).toBe(false);
  });

  it("bez zapisanej odmowy i przy uszkodzonej wartości baner jest widoczny", () => {
    expect(isPushBannerDismissed()).toBe(false);
    localStorage.setItem("czyzyk.pushBanner.dismissedAt", "x");
    expect(isPushBannerDismissed()).toBe(false);
  });
});

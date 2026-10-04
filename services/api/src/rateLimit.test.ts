import { describe, expect, it } from "vitest";
import { RateLimiter } from "./rateLimit.js";

describe("RateLimiter", () => {
  it("allows the limit per minute and resets in the next window", () => {
    let now = 0;
    const limiter = new RateLimiter(2, () => now);
    expect([limiter.hit("a"), limiter.hit("a"), limiter.hit("a")]).toEqual([true, true, false]);
    expect(limiter.hit("b")).toBe(true);
    now = 60_000;
    expect(limiter.hit("a")).toBe(true);
  });
});

/**
 * Fixed one-minute windows kept in memory. The API runs as a single Railway
 * instance, so a shared store is not needed.
 */
export class RateLimiter {
  private readonly windows = new Map<string, { start: number; count: number }>();

  constructor(
    private readonly limitPerMinute: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Records a hit and returns false when the key is over its limit. */
  hit(key: string): boolean {
    const now = this.now();
    const window = this.windows.get(key);
    if (!window || now - window.start >= 60_000) {
      this.windows.set(key, { start: now, count: 1 });
      this.prune(now);
      return true;
    }
    window.count += 1;
    return window.count <= this.limitPerMinute;
  }

  private prune(now: number) {
    if (this.windows.size < 10_000) return;
    for (const [key, w] of this.windows) if (now - w.start >= 60_000) this.windows.delete(key);
  }
}

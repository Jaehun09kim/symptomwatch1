/**
 * In-memory sliding-window rate limiter. Per process only — adequate for a
 * single-instance demo; production needs a shared store (see deployment checklist).
 */

export interface RateLimitRule {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(private readonly now: () => number = Date.now) {}

  check(key: string, rule: RateLimitRule): RateLimitResult {
    const now = this.now();
    const windowStart = now - rule.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((time) => time > windowStart);
    if (recent.length >= rule.limit) {
      this.hits.set(key, recent);
      return { allowed: false, remaining: 0, retryAfterMs: recent[0] + rule.windowMs - now };
    }
    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > 10_000) this.prune(windowStart);
    return { allowed: true, remaining: rule.limit - recent.length, retryAfterMs: 0 };
  }

  reset(): void {
    this.hits.clear();
  }

  private prune(windowStart: number): void {
    for (const [key, times] of this.hits) {
      if (times.every((time) => time <= windowStart)) this.hits.delete(key);
    }
  }
}

const limiterGlobal = globalThis as typeof globalThis & { __symptomWatchRateLimiter?: RateLimiter };

export function rateLimiter(): RateLimiter {
  limiterGlobal.__symptomWatchRateLimiter ??= new RateLimiter();
  return limiterGlobal.__symptomWatchRateLimiter;
}

export const RATE_LIMITS = {
  signIn: { limit: 8, windowMs: 10 * 60_000 },
  signUp: { limit: 5, windowMs: 60 * 60_000 },
  passwordReset: { limit: 5, windowMs: 60 * 60_000 },
  demoProvision: { limit: 6, windowMs: 60 * 60_000 },
  demoRequest: { limit: 5, windowMs: 60 * 60_000 },
} satisfies Record<string, RateLimitRule>;

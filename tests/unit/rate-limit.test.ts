import { describe, expect, it } from "vitest";
import { RateLimiter } from "@/lib/security/rate-limit";

describe("RateLimiter", () => {
  it("allows up to the limit within the window, then blocks with a retry hint", () => {
    let now = 1_000;
    const limiter = new RateLimiter(() => now);
    const rule = { limit: 3, windowMs: 60_000 };
    expect([1, 2, 3].map(() => limiter.check("k", rule).allowed)).toEqual([true, true, true]);
    const blocked = limiter.check("k", rule);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBe(60_000);
    now += 60_001;
    expect(limiter.check("k", rule).allowed).toBe(true);
  });

  it("tracks keys independently", () => {
    const limiter = new RateLimiter(() => 0);
    const rule = { limit: 1, windowMs: 1_000 };
    expect(limiter.check("a", rule).allowed).toBe(true);
    expect(limiter.check("b", rule).allowed).toBe(true);
    expect(limiter.check("a", rule).allowed).toBe(false);
  });
});

describe("RateLimiter scale", () => {
  it("multiplies the allowance but never removes the limit", () => {
    const limiter = new RateLimiter(() => 0, 3);
    const rule = { limit: 1, windowMs: 1_000 };
    expect([1, 2, 3].map(() => limiter.check("k", rule).allowed)).toEqual([true, true, true]);
    expect(limiter.check("k", rule).allowed).toBe(false);
  });
});

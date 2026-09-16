import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createAdminLoginRateLimiter } from "../admin-login-rate-limit";

const makeCtx = (ip: string) => ({
  request: { headers: {}, ip, socket: { remoteAddress: ip } },
  status: 200,
  body: undefined as unknown,
  set: vi.fn(),
});

describe("admin-login rate limiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T12:00:00.000Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("allows up to max requests per IP inside the window, then returns 429", async () => {
    const { middleware } = createAdminLoginRateLimiter({ max: 3, windowMs: 60_000 });
    const next = vi.fn(async () => {});

    for (let i = 0; i < 3; i += 1) {
      const ctx = makeCtx("1.1.1.1");
      await middleware(ctx as never, next);
      expect(ctx.status).toBe(200);
    }
    expect(next).toHaveBeenCalledTimes(3);

    const blocked = makeCtx("1.1.1.1");
    await middleware(blocked as never, next);
    expect(next).toHaveBeenCalledTimes(3);
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({
      error: {
        status: 429,
        name: "TooManyRequestsError",
        message: "Too many attempts, please try again later",
      },
    });
    expect(blocked.set).toHaveBeenCalledWith("Retry-After", "60");
  });

  it("tracks IPs independently", async () => {
    const { middleware } = createAdminLoginRateLimiter({ max: 1, windowMs: 60_000 });
    const next = vi.fn(async () => {});
    await middleware(makeCtx("1.1.1.1") as never, next);
    const other = makeCtx("2.2.2.2");
    await middleware(other as never, next);
    expect(other.status).toBe(200);
    expect(next).toHaveBeenCalledTimes(2);
  });

  it("forgets attempts after the window passes", async () => {
    const { middleware } = createAdminLoginRateLimiter({ max: 1, windowMs: 60_000 });
    const next = vi.fn(async () => {});
    await middleware(makeCtx("1.1.1.1") as never, next);
    vi.advanceTimersByTime(60_001);
    const again = makeCtx("1.1.1.1");
    await middleware(again as never, next);
    expect(again.status).toBe(200);
    expect(next).toHaveBeenCalledTimes(2);
  });

  it("gives two peers sharing a forwarded header separate buckets", async () => {
    // A client cannot forge x-forwarded-for to burn through someone else's allowance either.
    const { middleware } = createAdminLoginRateLimiter({ max: 1, windowMs: 60_000 });
    const next = vi.fn(async () => {});
    const peer = (remoteAddress: string) => ({
      ...makeCtx(remoteAddress),
      request: { headers: { "x-forwarded-for": "7.7.7.7" }, ip: "7.7.7.7", socket: { remoteAddress } },
    });
    await middleware(peer("9.9.9.9") as never, next);
    const other = peer("8.8.8.8");
    await middleware(other as never, next);
    expect(other.status).toBe(200);
  });

  it("defaults to 20 attempts per 5 minutes", async () => {
    const { middleware } = createAdminLoginRateLimiter();
    const next = vi.fn(async () => {});
    for (let i = 0; i < 20; i += 1) await middleware(makeCtx("1.1.1.1") as never, next);
    const blocked = makeCtx("1.1.1.1");
    await middleware(blocked as never, next);
    expect(blocked.status).toBe(429);
    expect(blocked.set).toHaveBeenCalledWith("Retry-After", "300");
  });

  it("keys on the TCP peer address, so rotating x-forwarded-for cannot open new buckets", async () => {
    const { middleware } = createAdminLoginRateLimiter({ max: 1, windowMs: 60_000 });
    const next = vi.fn(async () => {});
    const spoof = (xff: string) => ({
      ...makeCtx("9.9.9.9"),
      request: { headers: { "x-forwarded-for": xff }, ip: xff, socket: { remoteAddress: "9.9.9.9" } },
    });
    await middleware(spoof("1.1.1.1") as never, next);
    const second = spoof("2.2.2.2");
    await middleware(second as never, next);
    expect(second.status).toBe(429);
  });

  it("the Strapi factory returns a working limiter", async () => {
    const factory = (await import("../admin-login-rate-limit")).default;
    const mw = factory({ max: 1, windowMs: 60_000 }, { strapi: {} as never });
    const next = vi.fn(async () => {});
    await mw(makeCtx("7.7.7.7") as never, next);
    const blocked = makeCtx("7.7.7.7");
    await mw(blocked as never, next);
    expect(blocked.status).toBe(429);
  });

  it("never tracks more than maxEntries IPs", async () => {
    const { middleware } = createAdminLoginRateLimiter({ max: 1, windowMs: 60_000, maxEntries: 3 });
    const next = vi.fn(async () => {});
    // 10.0.0.0 uses its single allowed attempt.
    await middleware(makeCtx("10.0.0.0") as never, next);
    const blockedBeforeEviction = makeCtx("10.0.0.0");
    await middleware(blockedBeforeEviction as never, next);
    expect(blockedBeforeEviction.status).toBe(429);
    // Nine other IPs push the map past maxEntries, evicting the oldest bucket (10.0.0.0).
    for (let i = 1; i < 10; i += 1) await middleware(makeCtx(`10.0.0.${i}`) as never, next);
    // Without eviction this would still be 429; with eviction 10.0.0.0 starts a fresh window.
    const revisit = makeCtx("10.0.0.0");
    await middleware(revisit as never, next);
    expect(revisit.status).toBe(200);
  });
});

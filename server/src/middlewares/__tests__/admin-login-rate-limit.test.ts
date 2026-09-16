import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createAdminLoginRateLimiter } from "../admin-login-rate-limit";

const makeCtx = (ip: string) => ({
  request: { headers: {}, ip },
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

  it("uses x-forwarded-for when present", async () => {
    const { middleware } = createAdminLoginRateLimiter({ max: 1, windowMs: 60_000 });
    const next = vi.fn(async () => {});
    const first = {
      ...makeCtx("9.9.9.9"),
      request: { headers: { "x-forwarded-for": "7.7.7.7" }, ip: "9.9.9.9" },
    };
    const second = {
      ...makeCtx("8.8.8.8"),
      request: { headers: { "x-forwarded-for": "7.7.7.7" }, ip: "8.8.8.8" },
    };
    await middleware(first as never, next);
    await middleware(second as never, next);
    expect(second.status).toBe(429);
  });

  it("defaults to 5 attempts per 5 minutes", async () => {
    const { middleware } = createAdminLoginRateLimiter();
    const next = vi.fn(async () => {});
    for (let i = 0; i < 5; i += 1) await middleware(makeCtx("1.1.1.1") as never, next);
    const blocked = makeCtx("1.1.1.1");
    await middleware(blocked as never, next);
    expect(blocked.status).toBe(429);
    expect(blocked.set).toHaveBeenCalledWith("Retry-After", "300");
  });
});

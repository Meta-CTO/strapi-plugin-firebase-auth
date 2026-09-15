import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildRefreshCookieOptions, REFRESH_COOKIE_NAME } from "../admin-session-cookie";

const makeStrapi = (values: Record<string, unknown> = {}) => ({
  config: {
    get: vi.fn((key: string, fallback?: unknown) => (key in values ? values[key] : fallback)),
  },
  log: { warn: vi.fn() },
});

describe("admin-session-cookie", () => {
  const originalEnv = process.env.NODE_ENV;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T12:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
    process.env.NODE_ENV = originalEnv;
  });

  it("uses the core cookie name", () => {
    expect(REFRESH_COOKIE_NAME).toBe("strapi_admin_refresh");
  });

  it("applies Strapi defaults for a session cookie outside production", () => {
    process.env.NODE_ENV = "test";
    const opts = buildRefreshCookieOptions(makeStrapi(), "session");
    expect(opts).toEqual({
      httpOnly: true,
      secure: false,
      overwrite: true,
      domain: undefined,
      path: "/admin",
      sameSite: "lax",
      maxAge: undefined,
    });
  });

  it("reads domain, path and sameSite from admin.auth.cookie.*", () => {
    const opts = buildRefreshCookieOptions(
      makeStrapi({
        "admin.auth.cookie.domain": "example.com",
        "admin.auth.cookie.path": "/strapi/admin",
        "admin.auth.cookie.sameSite": "strict",
      }),
      "session"
    );
    expect(opts).toMatchObject({ domain: "example.com", path: "/strapi/admin", sameSite: "strict" });
  });

  it("falls back to admin.auth.domain for the domain", () => {
    const opts = buildRefreshCookieOptions(makeStrapi({ "admin.auth.domain": "example.com" }), "session");
    expect(opts.domain).toBe("example.com");
  });

  it("ignores an invalid domain with a warning", () => {
    const strapi = makeStrapi({ "admin.auth.cookie.domain": "https://bad.com/path" });
    const opts = buildRefreshCookieOptions(strapi, "session");
    expect(opts.domain).toBeUndefined();
    expect(strapi.log.warn).toHaveBeenCalledWith(expect.stringContaining("invalid admin auth cookie domain"));
  });

  it("ignores an invalid path with a warning", () => {
    const strapi = makeStrapi({ "admin.auth.cookie.path": "admin;evil" });
    const opts = buildRefreshCookieOptions(strapi, "session");
    expect(opts.path).toBe("/admin");
    expect(strapi.log.warn).toHaveBeenCalledWith(expect.stringContaining("invalid admin auth cookie path"));
  });

  it("honours an explicit boolean admin.auth.cookie.secure", () => {
    process.env.NODE_ENV = "production";
    expect(
      buildRefreshCookieOptions(makeStrapi({ "admin.auth.cookie.secure": false }), "session", undefined, true)
        .secure
    ).toBe(false);
    process.env.NODE_ENV = "test";
    expect(
      buildRefreshCookieOptions(makeStrapi({ "admin.auth.cookie.secure": true }), "session").secure
    ).toBe(true);
  });

  it("in production, secure follows the request when secureRequest is given", () => {
    process.env.NODE_ENV = "production";
    expect(buildRefreshCookieOptions(makeStrapi(), "session", undefined, true).secure).toBe(true);
    expect(buildRefreshCookieOptions(makeStrapi(), "session", undefined, false).secure).toBe(false);
    expect(buildRefreshCookieOptions(makeStrapi(), "session").secure).toBe(true);
  });

  it("refresh cookies expire at the idle lifespan when absolute expiry is later", () => {
    const now = Date.now();
    const absolute = new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();
    const opts = buildRefreshCookieOptions(makeStrapi(), "refresh", absolute);
    const fourteenDays = 14 * 24 * 60 * 60 * 1000;
    expect(opts.expires?.getTime()).toBe(now + fourteenDays);
    expect(opts.maxAge).toBe(fourteenDays);
  });

  it("refresh cookies expire at the absolute expiry when it is sooner", () => {
    const now = Date.now();
    const absolute = new Date(now + 60 * 1000).toISOString();
    const opts = buildRefreshCookieOptions(makeStrapi(), "refresh", absolute);
    expect(opts.expires?.getTime()).toBe(now + 60 * 1000);
    expect(opts.maxAge).toBe(60 * 1000);
  });

  it("uses admin.auth.sessions.idleRefreshTokenLifespan when configured", () => {
    const now = Date.now();
    const opts = buildRefreshCookieOptions(
      makeStrapi({ "admin.auth.sessions.idleRefreshTokenLifespan": 3600 }),
      "refresh",
      new Date(now + 10 * 24 * 60 * 60 * 1000).toISOString()
    );
    expect(opts.maxAge).toBe(3600 * 1000);
  });
});

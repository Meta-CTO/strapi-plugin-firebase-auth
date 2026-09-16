import type { Core } from "@strapi/strapi";
import type Koa from "koa";
import { getClientIP } from "../utils/client-ip";

export type AdminLoginRateLimitOptions = {
  /** Attempts allowed per IP inside one window. Default 5. */
  max?: number;
  /** Window length in milliseconds. Default 5 minutes. */
  windowMs?: number;
  /** Whether Strapi configured Koa as proxy-aware (server.proxy.koa); see getClientIP. */
  proxyConfigured?: boolean;
  /** Hard cap on tracked IPs. Default 10000. */
  maxEntries?: number;
};

const DEFAULT_MAX = 5;
const DEFAULT_WINDOW_MS = 5 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 10_000;

type Bucket = { count: number; windowStart: number };

/**
 * Fixed-window, per-IP limiter kept in process memory.
 * Good enough for an admin login endpoint on a single instance; a multi-instance
 * deployment gets a per-instance limit, which is still a meaningful brake.
 */
export function createAdminLoginRateLimiter(options: AdminLoginRateLimitOptions = {}) {
  const max = options.max ?? DEFAULT_MAX;
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const buckets = new Map<string, Bucket>();

  const sweep = (now: number) => {
    for (const [key, bucket] of buckets) {
      if (now - bucket.windowStart >= windowMs) buckets.delete(key);
    }
  };

  const middleware = async (ctx: Koa.Context, next: Koa.Next) => {
    const now = Date.now();
    if (buckets.size >= maxEntries) {
      sweep(now);
      // Still full after dropping expired windows: evict the oldest entries (Map keeps insertion order).
      while (buckets.size >= maxEntries) {
        const oldest = buckets.keys().next().value;
        if (oldest === undefined) break;
        buckets.delete(oldest);
      }
    }

    const ip = getClientIP(ctx, { proxyConfigured: options.proxyConfigured });
    const bucket = buckets.get(ip);

    if (!bucket || now - bucket.windowStart >= windowMs) {
      buckets.set(ip, { count: 1, windowStart: now });
      return next();
    }

    if (bucket.count >= max) {
      const retryAfterSeconds = Math.ceil((bucket.windowStart + windowMs - now) / 1000);
      ctx.set("Retry-After", String(retryAfterSeconds));
      ctx.status = 429;
      ctx.body = {
        error: {
          status: 429,
          name: "TooManyRequestsError",
          message: "Too many attempts, please try again later",
        },
      };
      return;
    }

    bucket.count += 1;
    return next();
  };

  return { middleware, reset: () => buckets.clear() };
}

/**
 * Strapi route-middleware factory. Referenced from routes as
 * "plugin::firebase-authentication.admin-login-rate-limit".
 */
export default (config: AdminLoginRateLimitOptions, { strapi }: { strapi: Core.Strapi }) =>
  createAdminLoginRateLimiter({
    ...(config ?? {}),
    proxyConfigured: Boolean(strapi.config.get("server.proxy.koa")),
  }).middleware;

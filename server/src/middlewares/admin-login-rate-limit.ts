import type { Core } from "@strapi/strapi";
import type Koa from "koa";
import { getClientIP } from "../utils/client-ip";

export type AdminLoginRateLimitOptions = {
  /** Attempts allowed per IP inside one window. Default 5. */
  max?: number;
  /** Window length in milliseconds. Default 5 minutes. */
  windowMs?: number;
};

const DEFAULT_MAX = 5;
const DEFAULT_WINDOW_MS = 5 * 60 * 1000;

type Bucket = { count: number; windowStart: number };

/**
 * Fixed-window, per-IP limiter kept in process memory.
 * Good enough for an admin login endpoint on a single instance; a multi-instance
 * deployment gets a per-instance limit, which is still a meaningful brake.
 */
export function createAdminLoginRateLimiter(options: AdminLoginRateLimitOptions = {}) {
  const max = options.max ?? DEFAULT_MAX;
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const buckets = new Map<string, Bucket>();

  const sweep = (now: number) => {
    for (const [key, bucket] of buckets) {
      if (now - bucket.windowStart >= windowMs) buckets.delete(key);
    }
  };

  const middleware = async (ctx: Koa.Context, next: Koa.Next) => {
    const now = Date.now();
    if (buckets.size > 1000) sweep(now);

    const ip = getClientIP(ctx);
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
export default (config: AdminLoginRateLimitOptions, _ctx: { strapi: Core.Strapi }) =>
  createAdminLoginRateLimiter(config ?? {}).middleware;

type HeaderValue = string | string[] | undefined;

export type ClientIpContext = {
  request: { headers: Record<string, HeaderValue>; ip?: string };
};

/**
 * Best-effort client IP: x-forwarded-for (first hop), then x-real-ip, then Koa's ctx.request.ip.
 */
export function getClientIP(ctx: ClientIpContext): string {
  const forwardedFor = ctx.request.headers["x-forwarded-for"];
  if (forwardedFor) {
    const first = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    return first.split(",")[0].trim();
  }

  const realIP = ctx.request.headers["x-real-ip"];
  if (realIP) {
    return Array.isArray(realIP) ? realIP[0] : realIP;
  }

  return ctx.request.ip || "unknown";
}

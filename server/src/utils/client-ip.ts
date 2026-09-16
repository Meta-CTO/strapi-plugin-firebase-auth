type HeaderValue = string | string[] | undefined;

export type ClientIpContext = {
  request: { headers: Record<string, HeaderValue>; ip?: string };
};

export type ClientIpOptions = {
  /**
   * When Strapi sets `server.proxy.koa` (the only key Koa reads), Koa already resolves the real client IP from the
   * trusted proxy headers into `ctx.request.ip`, so forwarded headers must not be re-read (they
   * would let a client spoof its own address). When no proxy is configured we keep the legacy
   * first-hop behaviour for installs sitting behind an unconfigured proxy.
   */
  proxyConfigured?: boolean;
};

/**
 * Best-effort client IP: x-forwarded-for (first hop), then x-real-ip, then Koa's ctx.request.ip.
 */
export function getClientIP(ctx: ClientIpContext, options: ClientIpOptions = {}): string {
  if (options.proxyConfigured) {
    return ctx.request.ip || "unknown";
  }

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

type HeaderValue = string | string[] | undefined;

export type ClientIpContext = {
  request: {
    headers: Record<string, HeaderValue>;
    ip?: string;
    socket?: { remoteAddress?: string };
  };
};

/**
 * Best-effort client address for audit records: x-forwarded-for (first hop), then x-real-ip, then
 * Koa's ctx.request.ip. Every one of those can be set by the caller, so treat the result as a
 * reported value, never as an identity. Anything making a security decision must use getPeerIP.
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

/**
 * Address of the machine actually holding the TCP connection, which a client cannot set.
 *
 * Koa's ctx.request.ip is not a substitute: with app.proxy enabled it returns the leftmost
 * X-Forwarded-For entry unless maxIpsCount is configured, and Strapi leaves that at Koa's default
 * of 0, so the value stays caller-controlled. Behind a reverse proxy this returns the proxy's own
 * address, meaning every client shares it; that is a visible misconfiguration rather than a
 * silently defeated control.
 */
export function getPeerIP(ctx: ClientIpContext): string {
  return ctx.request.socket?.remoteAddress || ctx.request.ip || "unknown";
}

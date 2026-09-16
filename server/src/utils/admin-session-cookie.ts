/**
 * Mirror of Strapi core's refresh-cookie options.
 *
 * Source of truth: @strapi/admin `shared/utils/session-auth.ts`,
 * `shared/utils/auth-cookie-domain.ts`, `shared/utils/auth-cookie-path.ts` (v5.53.0).
 * Those helpers are not exported from the package, so they are reproduced here.
 * Keep this file in sync when upgrading Strapi.
 */

export const REFRESH_COOKIE_NAME = "strapi_admin_refresh";

const DEFAULT_IDLE_REFRESH_TOKEN_LIFESPAN_SECONDS = 14 * 24 * 60 * 60;
const DEFAULT_COOKIE_PATH = "/admin";

export type RefreshCookieOptions = {
  httpOnly: true;
  secure: boolean;
  overwrite: true;
  domain?: string;
  path: string;
  sameSite: boolean | "lax" | "strict" | "none";
  maxAge?: number;
  expires?: Date;
};

export type CookieStrapi = {
  config: { get: (key: string, fallback?: unknown) => unknown };
  log: { warn: (message: string) => void };
};

// RFC 6265 domain-av: a bare host name. No scheme, path, port, whitespace or separators.
// eslint-disable-next-line no-control-regex
const INVALID_DOMAIN = /[\x00-\x1F\x7F;,\s/:]/;
// RFC 6265 path-av: any CHAR except CTLs or ";".
// eslint-disable-next-line no-control-regex
const INVALID_PATH = /[\x00-\x1F\x7F;]/;

const resolveDomain = (strapi: CookieStrapi): string | undefined => {
  const configured =
    (strapi.config.get("admin.auth.cookie.domain") as string | undefined) ||
    (strapi.config.get("admin.auth.domain") as string | undefined) ||
    "";
  const domain = configured.trim();
  if (!domain) return undefined;
  if (INVALID_DOMAIN.test(domain)) {
    strapi.log.warn(
      `[Firebase Auth Plugin] Ignoring invalid admin auth cookie domain "${domain}" (must be a bare host name); using a host-only cookie instead.`
    );
    return undefined;
  }
  return domain;
};

const resolvePath = (strapi: CookieStrapi): string => {
  const configured = ((strapi.config.get("admin.auth.cookie.path") as string | undefined) || "").trim();
  if (!configured) return DEFAULT_COOKIE_PATH;
  if (!configured.startsWith("/") || INVALID_PATH.test(configured)) {
    strapi.log.warn(
      `[Firebase Auth Plugin] Ignoring invalid admin auth cookie path "${configured}" (must be an absolute path without ";"); using "${DEFAULT_COOKIE_PATH}" instead.`
    );
    return DEFAULT_COOKIE_PATH;
  }
  return configured;
};

const resolveSecure = (strapi: CookieStrapi, secureRequest?: boolean): boolean => {
  const configured = strapi.config.get("admin.auth.cookie.secure");
  const isProduction = process.env.NODE_ENV === "production";
  if (typeof configured === "boolean") return configured;
  if (secureRequest !== undefined) return isProduction && secureRequest;
  return isProduction;
};

const baseOptions = (strapi: CookieStrapi, secureRequest?: boolean): RefreshCookieOptions => ({
  httpOnly: true,
  secure: resolveSecure(strapi, secureRequest),
  overwrite: true,
  domain: resolveDomain(strapi),
  path: resolvePath(strapi),
  sameSite:
    (strapi.config.get("admin.auth.cookie.sameSite") as RefreshCookieOptions["sameSite"] | undefined) ??
    "lax",
  maxAge: undefined,
});

/**
 * Build the options for the `strapi_admin_refresh` cookie exactly like core `POST /admin/login`.
 * `type` is "refresh" when the user asked to be remembered, "session" otherwise.
 */
export function buildRefreshCookieOptions(
  strapi: CookieStrapi,
  type: "refresh" | "session",
  absoluteExpiresAtISO?: string,
  secureRequest?: boolean
): RefreshCookieOptions {
  const base = baseOptions(strapi, secureRequest);
  if (type === "session") return base;

  const idleSeconds = Number(
    strapi.config.get(
      "admin.auth.sessions.idleRefreshTokenLifespan",
      DEFAULT_IDLE_REFRESH_TOKEN_LIFESPAN_SECONDS
    )
  );
  const now = Date.now();
  const idleExpiry = now + idleSeconds * 1000;
  const parsedAbsolute = absoluteExpiresAtISO ? new Date(absoluteExpiresAtISO).getTime() : Number.NaN;
  let absoluteExpiry = idleExpiry;
  if (absoluteExpiresAtISO !== undefined) {
    if (Number.isNaN(parsedAbsolute)) {
      strapi.log.warn(
        `[Firebase Auth Plugin] Ignoring invalid session expiry "${absoluteExpiresAtISO}"; using the idle refresh lifespan instead.`
      );
    } else {
      absoluteExpiry = parsedAbsolute;
    }
  }
  const chosen = new Date(Math.min(idleExpiry, absoluteExpiry));

  return { ...base, expires: chosen, maxAge: Math.max(0, chosen.getTime() - now) };
}

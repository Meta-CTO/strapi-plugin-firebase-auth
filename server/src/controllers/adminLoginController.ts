import type { Core } from "@strapi/strapi";
import type { Context } from "koa";
import { randomBytes, randomUUID } from "crypto";
import { pluginName } from "../firebaseAuthentication/types";
import { REFRESH_COOKIE_NAME } from "../utils/admin-session-cookie";
import { getClientIP } from "../utils/client-ip";
import { renderAdminLoginPage, buildAdminLoginCsp } from "../templates/admin-login-page";
import type { AdminLoginToken } from "../utils/admin-login-authorize";
import type { AdminUserRecord } from "../services/adminLoginService";

const MESSAGES = {
  unavailable: "Admin login is unavailable",
  authFailed: "Authentication failed",
  forbidden: "You are not authorized to access the admin panel",
} as const;

// Same shape yup's .uuid() accepts, which is what core uses to validate its own login deviceId:
// versions 1-5 with an RFC 4122 variant nibble, or the nil UUID.
const UUID_RE =
  /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000)$/i;

type LogParams = {
  ctx: Context;
  success: boolean;
  token?: AdminLoginToken | null;
  email?: string;
  reason?: string;
  via?: string;
  created?: boolean;
  user?: AdminUserRecord;
};

type StrapiWithFirebase = Core.Strapi & {
  firebase?: {
    auth: () => { verifyIdToken: (token: string, checkRevoked?: boolean) => Promise<AdminLoginToken> };
  };
};

export default ({ strapi }: { strapi: Core.Strapi }) => {
  const s = strapi as StrapiWithFirebase;
  const adminLogin = () => s.plugin(pluginName).service("adminLoginService");
  const activityLog = () => s.plugin(pluginName).service("activityLogService");

  const apiPrefix = () => String(s.config.get("api.rest.prefix", "/api")).replace(/\/$/, "");
  const baseUrl = () => `${apiPrefix()}/${pluginName}`;
  const adminUrl = () => String(s.config.get("admin.url", "/admin"));

  const sendUnavailable = (ctx: Context, reason: string) => {
    s.log.error(`[Firebase Auth Plugin] Admin login unavailable: ${reason}`);
    ctx.status = 503;
    ctx.body = { error: { status: 503, name: "ServiceUnavailableError", message: MESSAGES.unavailable } };
  };

  const log = ({ ctx, success, token, email, reason, via, created, user }: LogParams) => {
    void activityLog().logActivity({
      firebaseUserId: token?.uid ?? "unknown",
      strapiUserId: user ? String(user.id) : undefined,
      activityType: "authentication",
      action: success ? "admin_login" : "admin_login_denied",
      endpoint: ctx.path,
      method: ctx.method,
      ipAddress: getClientIP(ctx, { proxyConfigured: Boolean(s.config.get("server.proxy.koa")) }),
      userAgent: ctx.request.headers["user-agent"],
      success,
      errorMessage: success ? undefined : reason,
      performedBy: email,
      performedByType: "admin",
      metadata: { email, reason, via, created },
    });
  };

  /** Returns false when the request must stop (response already written). */
  const gate = (ctx: Context): boolean => {
    const service = adminLogin();
    if (!service.getConfig().enabled) {
      ctx.notFound();
      return false;
    }
    const availability = service.isAvailable();
    if (!availability.available) {
      sendUnavailable(ctx, availability.reason);
      return false;
    }
    return true;
  };

  return {
    async page(ctx: Context) {
      if (!gate(ctx)) return;

      const nonce = randomBytes(16).toString("base64");
      ctx.set("Content-Security-Policy", buildAdminLoginCsp(nonce));
      ctx.set("Cache-Control", "no-store");
      ctx.set("Referrer-Policy", "no-referrer");
      ctx.status = 200;
      ctx.type = "html";
      ctx.body = renderAdminLoginPage({
        nonce,
        configUrl: `${baseUrl()}/config`,
        loginUrl: `${baseUrl()}/admin-login`,
        adminUrl: adminUrl(),
      });
    },

    async login(ctx: Context) {
      if (!gate(ctx)) return;
      const service = adminLogin();

      const body = (ctx.request.body ?? {}) as {
        idToken?: unknown;
        deviceId?: unknown;
        rememberMe?: unknown;
      };
      if (typeof body.idToken !== "string" || body.idToken.length === 0) {
        log({ ctx, success: false, reason: "token_missing" });
        return ctx.unauthorized(MESSAGES.authFailed);
      }

      let decoded: AdminLoginToken;
      try {
        decoded = await s.firebase!.auth().verifyIdToken(body.idToken, true);
      } catch (error) {
        s.log.warn(`[Firebase Auth Plugin] Admin login token rejected: ${(error as Error).message}`);
        log({ ctx, success: false, reason: "token_invalid" });
        return ctx.unauthorized(MESSAGES.authFailed);
      }

      const authz = service.authorize(decoded);
      if (!authz.allowed) {
        log({ ctx, success: false, token: decoded, email: decoded.email, reason: authz.reason });
        if (authz.reason === "not_allowlisted") {
          return ctx.forbidden(MESSAGES.forbidden);
        }
        return ctx.unauthorized(MESSAGES.authFailed);
      }

      let resolved: Awaited<ReturnType<typeof service.resolveAdminUser>>;
      try {
        resolved = await service.resolveAdminUser(decoded, authz.email);
      } catch (error) {
        s.log.error(
          `[Firebase Auth Plugin] Admin login failed to resolve admin user: ${(error as Error).message}`
        );
        log({
          ctx,
          success: false,
          token: decoded,
          email: authz.email,
          reason: "resolve_error",
          via: authz.via,
        });
        ctx.status = 500;
        ctx.body = { error: { status: 500, name: "InternalServerError", message: "Internal Server Error" } };
        return;
      }
      if (!resolved.ok) {
        log({
          ctx,
          success: false,
          token: decoded,
          email: authz.email,
          reason: resolved.reason,
          via: authz.via,
        });
        return ctx.forbidden(MESSAGES.forbidden);
      }

      const deviceId =
        typeof body.deviceId === "string" && UUID_RE.test(body.deviceId) ? body.deviceId : randomUUID();
      const rememberMe = body.rememberMe === true;

      let session: Awaited<ReturnType<typeof service.createSession>>;
      try {
        session = await service.createSession(resolved.user.id, deviceId, rememberMe, ctx.request.secure);
      } catch (error) {
        s.log.error(
          `[Firebase Auth Plugin] Admin login failed to create session: ${(error as Error).message}`
        );
        log({
          ctx,
          success: false,
          token: decoded,
          email: authz.email,
          reason: "session_error",
          via: authz.via,
        });
        ctx.status = 500;
        ctx.body = { error: { status: 500, name: "InternalServerError", message: "Internal Server Error" } };
        return;
      }

      ctx.cookies.set(REFRESH_COOKIE_NAME, session.refreshToken, session.cookieOptions);
      const sanitizeUser = (s.service("admin::user") as { sanitizeUser: (user: AdminUserRecord) => unknown })
        .sanitizeUser;
      log({
        ctx,
        success: true,
        token: decoded,
        email: authz.email,
        via: authz.via,
        created: resolved.created,
        user: resolved.user,
      });

      ctx.set("Cache-Control", "no-store");
      ctx.status = 200;
      ctx.body = {
        data: {
          token: session.accessToken,
          accessToken: session.accessToken,
          user: sanitizeUser(resolved.user),
        },
      };
    },
  };
};

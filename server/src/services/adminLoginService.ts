import type { Core } from "@strapi/strapi";
import {
  authorizeAdminLogin,
  normalizeAdminLoginConfig,
  splitDisplayName,
  type AdminLoginConfig,
  type AdminLoginToken,
  type AuthorizeResult,
} from "../utils/admin-login-authorize";
import { buildRefreshCookieOptions, type RefreshCookieOptions } from "../utils/admin-session-cookie";

export type AdminUserRecord = {
  id: number | string;
  email: string;
  isActive?: boolean;
  blocked?: boolean;
  roles?: unknown[];
} & Record<string, unknown>;

export type ResolveResult =
  | { ok: true; user: AdminUserRecord; created: boolean }
  | { ok: false; reason: "inactive" | "blocked" | "not_found" | "role_not_found" };

export type SessionResult = {
  refreshToken: string;
  accessToken: string;
  cookieOptions: RefreshCookieOptions;
  cookieType: "refresh" | "session";
};

export type AvailabilityResult =
  | { available: true }
  | { available: false; reason: "no_session_manager" | "firebase_not_initialized" };

export const MIN_STRAPI_VERSION_MESSAGE =
  "[Firebase Auth Plugin] Admin login requires Strapi 5.24.0 or newer (strapi.sessionManager is missing)";

type OriginSessionManager = {
  generateRefreshToken: (
    userId: string,
    deviceId: string | undefined,
    options?: { type?: "refresh" | "session" }
  ) => Promise<{ token: string; sessionId: string; absoluteExpiresAt: string }>;
  generateAccessToken: (refreshToken: string) => Promise<{ token: string } | { error: string }>;
};

type StrapiWithExtras = Core.Strapi & {
  sessionManager?: ((origin: string) => OriginSessionManager) | null;
  firebase?: unknown;
};

export default ({ strapi }: { strapi: Core.Strapi }) => {
  const s = strapi as StrapiWithExtras;

  const service = {
    getConfig(): AdminLoginConfig {
      const pluginConfig = (s.config.get("plugin::firebase-authentication") ?? {}) as {
        adminLogin?: unknown;
      };
      return normalizeAdminLoginConfig(pluginConfig.adminLogin);
    },

    isAvailable(): AvailabilityResult {
      if (typeof s.sessionManager !== "function") {
        return { available: false, reason: "no_session_manager" };
      }
      if (!s.firebase) {
        return { available: false, reason: "firebase_not_initialized" };
      }
      return { available: true };
    },

    authorize(token: AdminLoginToken): AuthorizeResult {
      return authorizeAdminLogin(token, service.getConfig());
    },

    /**
     * Find the Strapi admin for this Firebase user, or create one when autoCreateRole is configured.
     * `email` must already be normalized (lowercase, trimmed) by `authorize`.
     */
    async resolveAdminUser(token: AdminLoginToken, email: string): Promise<ResolveResult> {
      const userService = s.service("admin::user") as {
        findOneByEmail: (email: string, populate?: string[]) => Promise<AdminUserRecord | null>;
        create: (attributes: Record<string, unknown>) => Promise<AdminUserRecord>;
      };

      const existing = await userService.findOneByEmail(email, ["roles"]);
      if (existing) {
        if (existing.blocked) return { ok: false, reason: "blocked" };
        if (existing.isActive !== true) return { ok: false, reason: "inactive" };
        return { ok: true, user: existing, created: false };
      }

      const { autoCreateRole } = service.getConfig();
      if (!autoCreateRole) return { ok: false, reason: "not_found" };

      const roleService = s.service("admin::role") as {
        findOne: (params: { code: string }) => Promise<{ id: number | string } | null>;
      };
      const role = await roleService.findOne({ code: autoCreateRole });
      if (!role) return { ok: false, reason: "role_not_found" };

      const { firstname, lastname } = splitDisplayName(token.name, email);
      const created = await userService.create({
        email,
        firstname,
        lastname,
        roles: [role.id],
        isActive: true,
        registrationToken: null,
      });
      return { ok: true, user: created, created: true };
    },

    /**
     * Mint an admin session exactly like core POST /admin/login.
     * No `metadata` option is passed so Strapi 5.24 to 5.52 keep working.
     */
    async createSession(
      userId: string | number,
      deviceId: string,
      rememberMe: boolean,
      secureRequest?: boolean
    ): Promise<SessionResult> {
      if (typeof s.sessionManager !== "function") {
        throw new Error(MIN_STRAPI_VERSION_MESSAGE);
      }
      const cookieType: "refresh" | "session" = rememberMe ? "refresh" : "session";
      const origin = s.sessionManager("admin");

      const { token: refreshToken, absoluteExpiresAt } = await origin.generateRefreshToken(
        String(userId),
        deviceId,
        {
          type: cookieType,
        }
      );

      const access = await origin.generateAccessToken(refreshToken);
      if ("error" in access) {
        throw new Error(`Session manager error: ${access.error}`);
      }

      const cookieOptions = buildRefreshCookieOptions(s, cookieType, absoluteExpiresAt, secureRequest);
      return { refreshToken, accessToken: access.token, cookieOptions, cookieType };
    },
  };

  return service;
};

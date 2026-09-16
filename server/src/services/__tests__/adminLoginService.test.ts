import { describe, it, expect, vi, beforeEach } from "vitest";
import createService from "../adminLoginService";

type MockStrapi = ReturnType<typeof makeStrapi>;

const makeStrapi = (
  over: { config?: Record<string, unknown>; sessionManager?: unknown; firebase?: unknown } = {}
) => {
  const adminUser = {
    findOneByEmail: vi.fn(),
    create: vi.fn(),
  };
  const adminRole = { findOne: vi.fn() };
  const services: Record<string, unknown> = { "admin::user": adminUser, "admin::role": adminRole };
  const configValues: Record<string, unknown> = {
    "plugin::firebase-authentication": { adminLogin: { enabled: true, allowedDomains: ["metacto.com"] } },
    ...over.config,
  };
  const sessionManager =
    over.sessionManager === undefined
      ? Object.assign(
          vi.fn(() => ({
            generateRefreshToken: vi.fn(async () => ({
              token: "refresh-1",
              sessionId: "s1",
              absoluteExpiresAt: "2026-10-15T12:00:00.000Z",
            })),
            generateAccessToken: vi.fn(async () => ({ token: "access-1" })),
          })),
          {}
        )
      : over.sessionManager;

  return {
    config: {
      get: vi.fn((key: string, fallback?: unknown) => (key in configValues ? configValues[key] : fallback)),
    },
    log: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
    service: vi.fn((uid: string) => services[uid]),
    sessionManager,
    firebase: over.firebase === undefined ? { auth: () => ({}) } : over.firebase,
    _adminUser: adminUser,
    _adminRole: adminRole,
  };
};

const token = (over: Record<string, unknown> = {}) => ({
  uid: "uid-1",
  email: "ana@metacto.com",
  email_verified: true,
  name: "Ana Silva",
  ...over,
});

describe("adminLoginService.getConfig", () => {
  it("normalizes the plugin config block", () => {
    const strapi = makeStrapi({
      config: {
        "plugin::firebase-authentication": {
          adminLogin: { enabled: true, allowedDomains: ["@MetaCTO.com"] },
        },
      },
    });
    const svc = createService({ strapi: strapi as never });
    expect(svc.getConfig()).toEqual({
      enabled: true,
      allowedEmails: [],
      allowedDomains: ["metacto.com"],
      autoCreateRole: null,
    });
  });

  it("returns safe defaults when the plugin config has no adminLogin block", () => {
    const strapi = makeStrapi({ config: { "plugin::firebase-authentication": {} } });
    const svc = createService({ strapi: strapi as never });
    expect(svc.getConfig().enabled).toBe(false);
  });
});

describe("adminLoginService.isAvailable", () => {
  it("is available when sessionManager and firebase exist", () => {
    const svc = createService({ strapi: makeStrapi() as never });
    expect(svc.isAvailable()).toEqual({ available: true });
  });

  it("reports a missing session manager (Strapi older than 5.24)", () => {
    const svc = createService({ strapi: makeStrapi({ sessionManager: null }) as never });
    expect(svc.isAvailable()).toEqual({ available: false, reason: "no_session_manager" });
  });

  it("reports Firebase not initialized", () => {
    const svc = createService({ strapi: makeStrapi({ firebase: null }) as never });
    expect(svc.isAvailable()).toEqual({ available: false, reason: "firebase_not_initialized" });
  });
});

describe("adminLoginService.authorize", () => {
  it("delegates to the pure rules with the normalized config", () => {
    const svc = createService({ strapi: makeStrapi() as never });
    expect(svc.authorize(token())).toEqual({ allowed: true, via: "domain", email: "ana@metacto.com" });
    expect(svc.authorize(token({ email: "x@other.com" }))).toEqual({
      allowed: false,
      reason: "not_allowlisted",
    });
  });
});

describe("adminLoginService.resolveAdminUser", () => {
  let strapi: MockStrapi;
  beforeEach(() => {
    strapi = makeStrapi();
  });

  it("returns an existing active admin without creating", async () => {
    const user = { id: 7, email: "ana@metacto.com", isActive: true, blocked: false, roles: [] };
    strapi._adminUser.findOneByEmail.mockResolvedValue(user);
    const svc = createService({ strapi: strapi as never });
    await expect(svc.resolveAdminUser(token(), "ana@metacto.com")).resolves.toEqual({
      ok: true,
      user,
      created: false,
    });
    expect(strapi._adminUser.findOneByEmail).toHaveBeenCalledWith("ana@metacto.com", ["roles"]);
    expect(strapi._adminUser.create).not.toHaveBeenCalled();
  });

  it("denies a blocked admin", async () => {
    strapi._adminUser.findOneByEmail.mockResolvedValue({ id: 7, isActive: true, blocked: true });
    const svc = createService({ strapi: strapi as never });
    await expect(svc.resolveAdminUser(token(), "ana@metacto.com")).resolves.toEqual({
      ok: false,
      reason: "blocked",
    });
  });

  it("denies an inactive admin", async () => {
    strapi._adminUser.findOneByEmail.mockResolvedValue({ id: 7, isActive: false, blocked: false });
    const svc = createService({ strapi: strapi as never });
    await expect(svc.resolveAdminUser(token(), "ana@metacto.com")).resolves.toEqual({
      ok: false,
      reason: "inactive",
    });
  });

  it("denies a missing admin when auto-create is off", async () => {
    strapi._adminUser.findOneByEmail.mockResolvedValue(null);
    const svc = createService({ strapi: strapi as never });
    await expect(svc.resolveAdminUser(token(), "ana@metacto.com")).resolves.toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(strapi._adminRole.findOne).not.toHaveBeenCalled();
  });

  it("creates an active admin with the configured role when auto-create is on", async () => {
    strapi = makeStrapi({
      config: {
        "plugin::firebase-authentication": {
          adminLogin: { enabled: true, allowedDomains: ["metacto.com"], autoCreateRole: "strapi-editor" },
        },
      },
    });
    strapi._adminUser.findOneByEmail.mockResolvedValue(null);
    strapi._adminRole.findOne.mockResolvedValue({ id: 3, code: "strapi-editor" });
    const created = { id: 9, email: "ana@metacto.com", isActive: true, roles: [{ id: 3 }] };
    strapi._adminUser.create.mockResolvedValue(created);

    const svc = createService({ strapi: strapi as never });
    await expect(svc.resolveAdminUser(token(), "ana@metacto.com")).resolves.toEqual({
      ok: true,
      user: created,
      created: true,
    });
    expect(strapi._adminRole.findOne).toHaveBeenCalledWith({ code: "strapi-editor" });
    expect(strapi._adminUser.create).toHaveBeenCalledWith({
      email: "ana@metacto.com",
      firstname: "Ana",
      lastname: "Silva",
      roles: [3],
      isActive: true,
      registrationToken: null,
    });
  });

  it("re-reads and returns the winner when a concurrent first login races the unique index", async () => {
    strapi = makeStrapi({
      config: {
        "plugin::firebase-authentication": {
          adminLogin: { enabled: true, allowedDomains: ["metacto.com"], autoCreateRole: "strapi-editor" },
        },
      },
    });
    const user = { id: 11, email: "ana@metacto.com", isActive: true, blocked: false, roles: [] };
    strapi._adminUser.findOneByEmail.mockResolvedValueOnce(null).mockResolvedValueOnce(user);
    strapi._adminRole.findOne.mockResolvedValue({ id: 3, code: "strapi-editor" });
    strapi._adminUser.create.mockRejectedValue(new Error("unique constraint"));

    const svc = createService({ strapi: strapi as never });
    await expect(svc.resolveAdminUser(token(), "ana@metacto.com")).resolves.toEqual({
      ok: true,
      user,
      created: false,
    });
  });

  it("rethrows the create error when the re-read also finds nothing", async () => {
    strapi = makeStrapi({
      config: {
        "plugin::firebase-authentication": {
          adminLogin: { enabled: true, allowedDomains: ["metacto.com"], autoCreateRole: "strapi-editor" },
        },
      },
    });
    strapi._adminUser.findOneByEmail.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    strapi._adminRole.findOne.mockResolvedValue({ id: 3, code: "strapi-editor" });
    strapi._adminUser.create.mockRejectedValue(new Error("unique constraint"));

    const svc = createService({ strapi: strapi as never });
    await expect(svc.resolveAdminUser(token(), "ana@metacto.com")).rejects.toThrow(/unique constraint/);
  });

  it("denies when the configured role does not exist", async () => {
    strapi = makeStrapi({
      config: {
        "plugin::firebase-authentication": {
          adminLogin: { enabled: true, allowedDomains: ["metacto.com"], autoCreateRole: "missing-role" },
        },
      },
    });
    strapi._adminUser.findOneByEmail.mockResolvedValue(null);
    strapi._adminRole.findOne.mockResolvedValue(null);
    const svc = createService({ strapi: strapi as never });
    await expect(svc.resolveAdminUser(token(), "ana@metacto.com")).resolves.toEqual({
      ok: false,
      reason: "role_not_found",
    });
    expect(strapi._adminUser.create).not.toHaveBeenCalled();
  });
});

describe("adminLoginService.createSession", () => {
  it("mints refresh and access tokens and builds cookie options", async () => {
    const strapi = makeStrapi();
    const svc = createService({ strapi: strapi as never });
    const result = await svc.createSession(7, "device-1", true, false);

    expect(strapi.sessionManager).toHaveBeenCalledWith("admin");
    const origin = (strapi.sessionManager as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(origin.generateRefreshToken).toHaveBeenCalledWith("7", "device-1", { type: "refresh" });
    expect(origin.generateAccessToken).toHaveBeenCalledWith("refresh-1");
    expect(result).toMatchObject({
      refreshToken: "refresh-1",
      accessToken: "access-1",
      cookieType: "refresh",
      cookieOptions: { httpOnly: true, path: "/admin", sameSite: "lax" },
    });
    expect(result.cookieOptions.expires).toBeInstanceOf(Date);
  });

  it("uses a session-type token when rememberMe is false", async () => {
    const strapi = makeStrapi();
    const svc = createService({ strapi: strapi as never });
    const result = await svc.createSession("7", "device-1", false);
    const origin = (strapi.sessionManager as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(origin.generateRefreshToken).toHaveBeenCalledWith("7", "device-1", { type: "session" });
    expect(result.cookieType).toBe("session");
    expect(result.cookieOptions.expires).toBeUndefined();
  });

  it("throws when the session manager reports an error", async () => {
    const strapi = makeStrapi({
      sessionManager: vi.fn(() => ({
        generateRefreshToken: vi.fn(async () => ({
          token: "r",
          sessionId: "s",
          absoluteExpiresAt: "2026-10-15T12:00:00.000Z",
        })),
        generateAccessToken: vi.fn(async () => ({ error: "boom" })),
      })),
    });
    const svc = createService({ strapi: strapi as never });
    await expect(svc.createSession(7, "d", true)).rejects.toThrow(/Session manager error: boom/);
  });

  it("throws when the session manager is missing", async () => {
    const svc = createService({ strapi: makeStrapi({ sessionManager: null }) as never });
    await expect(svc.createSession(7, "d", true)).rejects.toThrow(/requires Strapi 5.24.0 or newer/);
  });
});

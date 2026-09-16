import { describe, it, expect, vi, beforeEach } from "vitest";
import createController from "../adminLoginController";

const makeService = (over: Record<string, unknown> = {}) => ({
  getConfig: vi.fn(() => ({
    enabled: true,
    allowedEmails: [],
    allowedDomains: ["metacto.com"],
    autoCreateRole: null,
  })),
  isAvailable: vi.fn(() => ({ available: true })),
  authorize: vi.fn(() => ({ allowed: true, via: "domain", email: "ana@metacto.com" })),
  resolveAdminUser: vi.fn(async () => ({
    ok: true,
    created: false,
    user: { id: 7, email: "ana@metacto.com", isActive: true, roles: [{ id: 1, code: "strapi-editor" }] },
  })),
  createSession: vi.fn(async () => ({
    refreshToken: "refresh-1",
    accessToken: "access-1",
    cookieType: "refresh",
    cookieOptions: { httpOnly: true, secure: false, overwrite: true, path: "/admin", sameSite: "lax" },
  })),
  ...over,
});

const makeStrapi = (service: ReturnType<typeof makeService>, over: Record<string, unknown> = {}) => {
  const logActivity = vi.fn(async () => undefined);
  const sanitizeUser = vi.fn((user: Record<string, unknown>) => ({ ...user, sanitized: true }));
  const verifyIdToken = vi.fn(async () => ({
    uid: "uid-1",
    email: "  Ana@MetaCTO.com ",
    email_verified: true,
  }));
  return {
    config: {
      get: vi.fn((key: string, fallback?: unknown) => {
        const values: Record<string, unknown> = { "api.rest.prefix": "/api", "admin.url": "/admin" };
        return key in values ? values[key] : fallback;
      }),
    },
    log: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
    plugin: vi.fn(() => ({
      service: vi.fn((name: string) => (name === "adminLoginService" ? service : { logActivity })),
    })),
    service: vi.fn(() => ({ sanitizeUser })),
    firebase: { auth: () => ({ verifyIdToken }) },
    _logActivity: logActivity,
    _verifyIdToken: verifyIdToken,
    _sanitizeUser: sanitizeUser,
    ...over,
  };
};

const makeCtx = (
  body: unknown = { idToken: "id-1", deviceId: "123e4567-e89b-42d3-a456-426614174000", rememberMe: true }
) => {
  const ctx: Record<string, unknown> & { status: number; body: unknown } = {
    request: { body, headers: { "user-agent": "vitest" }, ip: "1.2.3.4", secure: false },
    path: "/api/firebase-authentication/admin-login",
    method: "POST",
    status: 404,
    body: undefined,
    type: "",
    cookies: { set: vi.fn() },
    set: vi.fn(),
    notFound: vi.fn(function (this: typeof ctx) {
      this.status = 404;
      this.body = { error: { status: 404, name: "NotFoundError", message: "Not Found" } };
    }),
    unauthorized: vi.fn(function (this: typeof ctx, message: string) {
      this.status = 401;
      this.body = { error: { status: 401, name: "UnauthorizedError", message } };
    }),
    forbidden: vi.fn(function (this: typeof ctx, message: string) {
      this.status = 403;
      this.body = { error: { status: 403, name: "ForbiddenError", message } };
    }),
  };
  return ctx;
};

describe("adminLoginController.page", () => {
  it("returns 404 when the feature is disabled", async () => {
    const service = makeService({ getConfig: vi.fn(() => ({ enabled: false })) });
    const controller = createController({ strapi: makeStrapi(service) as never });
    const ctx = makeCtx();
    await controller.page(ctx as never);
    expect(ctx.status).toBe(404);
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it("returns 503 when unavailable", async () => {
    const service = makeService({
      isAvailable: vi.fn(() => ({ available: false, reason: "no_session_manager" })),
    });
    const strapi = makeStrapi(service);
    const controller = createController({ strapi: strapi as never });
    const ctx = makeCtx();
    await controller.page(ctx as never);
    expect(ctx.status).toBe(503);
    expect(ctx.body).toEqual({
      error: { status: 503, name: "ServiceUnavailableError", message: "Admin login is unavailable" },
    });
    expect(strapi.log.error).toHaveBeenCalledWith(expect.stringContaining("no_session_manager"));
  });

  it("serves HTML with a nonce-bearing CSP and the plugin URLs", async () => {
    const controller = createController({ strapi: makeStrapi(makeService()) as never });
    const ctx = makeCtx();
    await controller.page(ctx as never);
    expect(ctx.status).toBe(200);
    expect(ctx.type).toBe("html");
    const cspCall = (ctx.set as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) => c[0] === "Content-Security-Policy"
    );
    expect(cspCall).toBeDefined();
    const nonce = /'nonce-([^']+)'/.exec(cspCall![1] as string)![1];
    expect(nonce.length).toBeGreaterThanOrEqual(16);
    expect(ctx.body).toContain(`nonce="${nonce}"`);
    expect(ctx.body).toContain('"configUrl":"/api/firebase-authentication/config"');
    expect(ctx.body).toContain('"loginUrl":"/api/firebase-authentication/admin-login"');
    expect(ctx.body).toContain('"adminUrl":"/admin"');
    expect(ctx.set).toHaveBeenCalledWith("Cache-Control", "no-store");
  });
});

describe("adminLoginController.login", () => {
  let service: ReturnType<typeof makeService>;
  let strapi: ReturnType<typeof makeStrapi>;

  beforeEach(() => {
    service = makeService();
    strapi = makeStrapi(service);
  });

  it("returns 404 when disabled and logs nothing", async () => {
    service.getConfig.mockReturnValue({
      enabled: false,
      allowedEmails: [],
      allowedDomains: [],
      autoCreateRole: null,
    });
    const ctx = makeCtx();
    await createController({ strapi: strapi as never }).login(ctx as never);
    expect(ctx.status).toBe(404);
    expect(ctx.notFound).toHaveBeenCalled();
    expect(strapi._logActivity).not.toHaveBeenCalled();
  });

  it("returns 503 when unavailable", async () => {
    service.isAvailable.mockReturnValue({ available: false, reason: "firebase_not_initialized" });
    const ctx = makeCtx();
    await createController({ strapi: strapi as never }).login(ctx as never);
    expect(ctx.status).toBe(503);
  });

  it("returns 401 when idToken is missing", async () => {
    const ctx = makeCtx({});
    await createController({ strapi: strapi as never }).login(ctx as never);
    expect(ctx.status).toBe(401);
    expect(ctx.body).toMatchObject({ error: { message: "Authentication failed" } });
    expect(strapi._logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "admin_login_denied",
        firebaseUserId: "unknown",
        errorMessage: "token_missing",
        success: false,
      })
    );
  });

  it("returns 401 when Firebase rejects the token, with revocation check on", async () => {
    strapi._verifyIdToken.mockRejectedValue(new Error("expired"));
    const ctx = makeCtx();
    await createController({ strapi: strapi as never }).login(ctx as never);
    expect(strapi._verifyIdToken).toHaveBeenCalledWith("id-1", true);
    expect(ctx.status).toBe(401);
    expect(ctx.body).toMatchObject({ error: { message: "Authentication failed" } });
    expect(strapi._logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ errorMessage: "token_invalid" })
    );
  });

  it("returns 401 for unverified email and email_missing", async () => {
    for (const reason of ["email_unverified", "email_missing"] as const) {
      service.authorize.mockReturnValue({ allowed: false, reason });
      const ctx = makeCtx();
      await createController({ strapi: strapi as never }).login(ctx as never);
      expect(ctx.status).toBe(401);
      expect(strapi._logActivity).toHaveBeenCalledWith(expect.objectContaining({ errorMessage: reason }));
    }
  });

  it("returns the same 403 message for every authorization and resolution denial", async () => {
    const message = "You are not authorized to access the admin panel";

    service.authorize.mockReturnValue({ allowed: false, reason: "not_allowlisted" });
    let ctx = makeCtx();
    await createController({ strapi: strapi as never }).login(ctx as never);
    expect(ctx.status).toBe(403);
    expect(ctx.body).toMatchObject({ error: { message } });
    expect(service.resolveAdminUser).not.toHaveBeenCalled();

    service.authorize.mockReturnValue({ allowed: true, via: "domain", email: "ana@metacto.com" });
    for (const reason of ["inactive", "blocked", "not_found", "role_not_found"] as const) {
      service.resolveAdminUser.mockResolvedValue({ ok: false, reason });
      ctx = makeCtx();
      await createController({ strapi: strapi as never }).login(ctx as never);
      expect(ctx.status).toBe(403);
      expect(ctx.body).toMatchObject({ error: { message } });
      expect(strapi._logActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "admin_login_denied",
          errorMessage: reason,
          firebaseUserId: "uid-1",
        })
      );
    }
  });

  it("returns 500 when resolveAdminUser throws unexpectedly", async () => {
    service.resolveAdminUser.mockRejectedValue(new Error("db down"));
    const ctx = makeCtx();
    await createController({ strapi: strapi as never }).login(ctx as never);
    expect(ctx.status).toBe(500);
    expect(ctx.body).toEqual({
      error: { status: 500, name: "InternalServerError", message: "Internal Server Error" },
    });
    expect(ctx.cookies.set).not.toHaveBeenCalled();
    expect(strapi._logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ errorMessage: "resolve_error" })
    );
  });

  it("returns 500 when the session cannot be minted", async () => {
    service.createSession.mockRejectedValue(new Error("Session manager error: boom"));
    const ctx = makeCtx();
    await createController({ strapi: strapi as never }).login(ctx as never);
    expect(ctx.status).toBe(500);
    expect(ctx.body).toEqual({
      error: { status: 500, name: "InternalServerError", message: "Internal Server Error" },
    });
    expect(strapi.log.error).toHaveBeenCalled();
    expect(ctx.cookies.set).not.toHaveBeenCalled();
  });

  it("on success sets the refresh cookie and returns the core login body shape", async () => {
    const ctx = makeCtx();
    await createController({ strapi: strapi as never }).login(ctx as never);

    expect(service.resolveAdminUser).toHaveBeenCalledWith(
      expect.objectContaining({ uid: "uid-1" }),
      "ana@metacto.com"
    );
    expect(service.resolveAdminUser).not.toHaveBeenCalledWith(expect.anything(), "  Ana@MetaCTO.com ");
    expect(service.createSession).toHaveBeenCalledWith(
      7,
      "123e4567-e89b-42d3-a456-426614174000",
      true,
      false
    );
    expect(ctx.cookies.set).toHaveBeenCalledWith(
      "strapi_admin_refresh",
      "refresh-1",
      expect.objectContaining({ httpOnly: true, path: "/admin" })
    );
    expect(ctx.status).toBe(200);
    expect(ctx.body).toEqual({
      data: {
        token: "access-1",
        accessToken: "access-1",
        user: expect.objectContaining({ id: 7, sanitized: true }),
      },
    });
    expect(strapi._sanitizeUser).toHaveBeenCalled();
    expect(ctx.set).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(strapi._logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "admin_login",
        success: true,
        firebaseUserId: "uid-1",
        strapiUserId: "7",
        performedByType: "admin",
        ipAddress: "1.2.3.4",
        userAgent: "vitest",
        metadata: expect.objectContaining({ email: "ana@metacto.com", via: "domain", created: false }),
      })
    );
  });

  it("generates a deviceId when the client sends none and treats rememberMe as false by default", async () => {
    const ctx = makeCtx({ idToken: "id-1" });
    await createController({ strapi: strapi as never }).login(ctx as never);
    const [, deviceId, rememberMe] = service.createSession.mock.calls[0];
    expect(typeof deviceId).toBe("string");
    expect((deviceId as string).length).toBeGreaterThan(0);
    expect(rememberMe).toBe(false);
  });

  it("replaces a non-UUID deviceId with a fresh UUID", async () => {
    const ctx = makeCtx({ idToken: "id-1", deviceId: "x".repeat(300), rememberMe: false });
    await createController({ strapi: strapi as never }).login(ctx as never);
    const [, deviceId] = service.createSession.mock.calls[0];
    expect(deviceId).not.toBe("x".repeat(300));
    expect(deviceId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it("rejects a UUID-shaped string with a non-RFC-4122 version or variant", async () => {
    for (const bad of ["123e4567-e89b-62d3-a456-426614174000", "123e4567-e89b-42d3-c456-426614174000"]) {
      service.createSession.mockClear();
      const ctx = makeCtx({ idToken: "id-1", deviceId: bad, rememberMe: false });
      await createController({ strapi: strapi as never }).login(ctx as never);
      expect(service.createSession.mock.calls[0][1]).not.toBe(bad);
    }
  });

  it("accepts the nil UUID, like core's validator", async () => {
    const ctx = makeCtx({
      idToken: "id-1",
      deviceId: "00000000-0000-0000-0000-000000000000",
      rememberMe: false,
    });
    await createController({ strapi: strapi as never }).login(ctx as never);
    expect(service.createSession.mock.calls[0][1]).toBe("00000000-0000-0000-0000-000000000000");
  });

  it("keeps a well-formed deviceId", async () => {
    const ctx = makeCtx({
      idToken: "id-1",
      deviceId: "123e4567-e89b-42d3-a456-426614174000",
      rememberMe: false,
    });
    await createController({ strapi: strapi as never }).login(ctx as never);
    expect(service.createSession.mock.calls[0][1]).toBe("123e4567-e89b-42d3-a456-426614174000");
  });
});

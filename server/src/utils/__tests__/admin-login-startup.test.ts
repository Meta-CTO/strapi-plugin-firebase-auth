import { describe, it, expect, vi } from "vitest";
import { reportAdminLoginStartup } from "../admin-login-startup";

const log = () => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() });

describe("reportAdminLoginStartup", () => {
  it("stays silent when the feature is disabled", () => {
    const l = log();
    reportAdminLoginStartup(
      { enabled: false, allowedEmails: [], allowedDomains: [], autoCreateRole: null },
      { hasSessionManager: true, log: l }
    );
    expect(l.warn).not.toHaveBeenCalled();
    expect(l.error).not.toHaveBeenCalled();
    expect(l.info).not.toHaveBeenCalled();
  });

  it("logs an error naming Strapi 5.24.0 when the session manager is missing", () => {
    const l = log();
    reportAdminLoginStartup(
      { enabled: true, allowedEmails: [], allowedDomains: ["metacto.com"], autoCreateRole: null },
      { hasSessionManager: false, log: l }
    );
    expect(l.error).toHaveBeenCalledWith(expect.stringContaining("5.24.0"));
  });

  it("warns when enabled with an empty allowlist", () => {
    const l = log();
    reportAdminLoginStartup(
      { enabled: true, allowedEmails: [], allowedDomains: [], autoCreateRole: null },
      { hasSessionManager: true, log: l }
    );
    expect(l.warn).toHaveBeenCalledWith(expect.stringContaining("strapiAdmin"));
  });

  it("logs an info summary when enabled and configured", () => {
    const l = log();
    reportAdminLoginStartup(
      {
        enabled: true,
        allowedEmails: ["a@b.com"],
        allowedDomains: ["metacto.com"],
        autoCreateRole: "strapi-editor",
      },
      { hasSessionManager: true, log: l }
    );
    expect(l.info).toHaveBeenCalledWith(expect.stringContaining("1 email(s), 1 domain(s)"));
    expect(l.info).toHaveBeenCalledWith(expect.stringContaining("auto-create role: strapi-editor"));
    expect(l.warn).not.toHaveBeenCalled();
  });
});

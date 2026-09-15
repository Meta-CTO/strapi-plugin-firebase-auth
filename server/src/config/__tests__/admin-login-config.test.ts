import { describe, it, expect } from "vitest";
import config from "../index";
import { normalizeAdminLoginConfig, DEFAULT_ADMIN_LOGIN_CONFIG } from "../../utils/admin-login-authorize";

const env = Object.assign((key: string, fallback?: unknown) => process.env[key] ?? fallback, {
  bool: (key: string, fallback: boolean) =>
    process.env[key] === undefined ? fallback : process.env[key] === "true",
  int: (key: string, fallback: number | null) =>
    process.env[key] === undefined ? fallback : Number(process.env[key]),
});

describe("adminLogin config defaults", () => {
  it("is disabled by default with empty allowlists and no auto-create", () => {
    const defaults = config.default({ env });
    expect(defaults.adminLogin).toEqual({
      enabled: false,
      allowedEmails: [],
      allowedDomains: [],
      autoCreateRole: null,
    });
  });
});

describe("adminLogin config validator", () => {
  const base = { firebaseJsonEncryptionKey: "k" };

  it("accepts a valid adminLogin block", () => {
    expect(() =>
      config.validator({
        ...base,
        adminLogin: { enabled: true, allowedDomains: ["metacto.com"], autoCreateRole: "strapi-editor" },
      })
    ).not.toThrow();
  });

  it("rejects non-array allowedEmails", () => {
    expect(() => config.validator({ ...base, adminLogin: { allowedEmails: "a@b.com" } })).toThrow(
      /adminLogin.allowedEmails must be an array of strings/
    );
  });

  it("rejects non-array allowedDomains", () => {
    expect(() => config.validator({ ...base, adminLogin: { allowedDomains: [1] } })).toThrow(
      /adminLogin.allowedDomains must be an array of strings/
    );
  });

  it("rejects autoCreateRole that is neither string nor null", () => {
    expect(() => config.validator({ ...base, adminLogin: { autoCreateRole: true } })).toThrow(
      /adminLogin.autoCreateRole must be a role code string or null/
    );
  });

  it("rejects non-boolean enabled", () => {
    expect(() => config.validator({ ...base, adminLogin: { enabled: "yes" } })).toThrow(
      /adminLogin.enabled must be a boolean/
    );
  });
});

describe("normalizeAdminLoginConfig", () => {
  it("fills defaults for a missing block", () => {
    expect(normalizeAdminLoginConfig(undefined)).toEqual(DEFAULT_ADMIN_LOGIN_CONFIG);
  });

  it("trims, lowercases, strips leading @ and drops empties", () => {
    expect(
      normalizeAdminLoginConfig({
        enabled: true,
        allowedEmails: [" Admin@MetaCTO.com ", ""],
        allowedDomains: ["@MetaCTO.com", " example.org "],
        autoCreateRole: " strapi-editor ",
      })
    ).toEqual({
      enabled: true,
      allowedEmails: ["admin@metacto.com"],
      allowedDomains: ["metacto.com", "example.org"],
      autoCreateRole: "strapi-editor",
    });
  });

  it("treats empty autoCreateRole as null", () => {
    expect(normalizeAdminLoginConfig({ autoCreateRole: "  " }).autoCreateRole).toBeNull();
  });
});

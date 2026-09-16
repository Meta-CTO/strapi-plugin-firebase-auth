import { describe, it, expect } from "vitest";
import {
  authorizeAdminLogin,
  splitDisplayName,
  ADMIN_CLAIM,
  type AdminLoginConfig,
} from "../admin-login-authorize";

const config = (over: Partial<AdminLoginConfig> = {}): AdminLoginConfig => ({
  enabled: true,
  allowedEmails: [],
  allowedDomains: [],
  autoCreateRole: null,
  ...over,
});

const token = (over: Record<string, unknown> = {}) => ({
  uid: "uid-1",
  email: "Ana@MetaCTO.com",
  email_verified: true,
  ...over,
});

describe("authorizeAdminLogin", () => {
  it("denies when the token has no email", () => {
    expect(
      authorizeAdminLogin(token({ email: undefined }), config({ allowedDomains: ["metacto.com"] }))
    ).toEqual({
      allowed: false,
      reason: "email_missing",
    });
  });

  it("denies when the email is not verified, even if allowlisted and claimed", () => {
    expect(
      authorizeAdminLogin(
        token({ email_verified: false, [ADMIN_CLAIM]: true }),
        config({ allowedEmails: ["ana@metacto.com"] })
      )
    ).toEqual({ allowed: false, reason: "email_unverified" });
  });

  it("allows an allowlisted email, case-insensitively, and returns the normalized email", () => {
    expect(authorizeAdminLogin(token(), config({ allowedEmails: ["ana@metacto.com"] }))).toEqual({
      allowed: true,
      via: "email",
      email: "ana@metacto.com",
    });
  });

  it("allows an allowlisted domain", () => {
    expect(authorizeAdminLogin(token(), config({ allowedDomains: ["metacto.com"] }))).toEqual({
      allowed: true,
      via: "domain",
      email: "ana@metacto.com",
    });
  });

  it("does not match a domain by suffix", () => {
    expect(
      authorizeAdminLogin(token({ email: "x@evilmetacto.com" }), config({ allowedDomains: ["metacto.com"] }))
    ).toEqual({
      allowed: false,
      reason: "not_allowlisted",
    });
  });

  it("allows a truthy strapiAdmin claim", () => {
    expect(authorizeAdminLogin(token({ [ADMIN_CLAIM]: true }), config())).toEqual({
      allowed: true,
      via: "claim",
      email: "ana@metacto.com",
    });
  });

  it("denies a falsy strapiAdmin claim", () => {
    expect(authorizeAdminLogin(token({ [ADMIN_CLAIM]: false }), config())).toEqual({
      allowed: false,
      reason: "not_allowlisted",
    });
    expect(authorizeAdminLogin(token({ [ADMIN_CLAIM]: "" }), config())).toEqual({
      allowed: false,
      reason: "not_allowlisted",
    });
  });

  it("denies everything when nothing is configured", () => {
    expect(authorizeAdminLogin(token(), config())).toEqual({ allowed: false, reason: "not_allowlisted" });
  });

  it("prefers the email match over domain and claim in the via field", () => {
    expect(
      authorizeAdminLogin(
        token({ [ADMIN_CLAIM]: true }),
        config({ allowedEmails: ["ana@metacto.com"], allowedDomains: ["metacto.com"] })
      )
    ).toMatchObject({ via: "email" });
  });
});

describe("splitDisplayName", () => {
  it("splits a two-word name", () => {
    expect(splitDisplayName("Ana Silva", "ana@x.com")).toEqual({ firstname: "Ana", lastname: "Silva" });
  });

  it("joins extra words into the last name", () => {
    expect(splitDisplayName("Ana Maria da Silva", "ana@x.com")).toEqual({
      firstname: "Ana",
      lastname: "Maria da Silva",
    });
  });

  it("uses a dash for a single-word name", () => {
    expect(splitDisplayName("Ana", "ana@x.com")).toEqual({ firstname: "Ana", lastname: "-" });
  });

  it("falls back to the email local part when the name is missing or blank", () => {
    expect(splitDisplayName(undefined, "ana.silva@x.com")).toEqual({ firstname: "ana.silva", lastname: "-" });
    expect(splitDisplayName("   ", "ana.silva@x.com")).toEqual({ firstname: "ana.silva", lastname: "-" });
  });
});

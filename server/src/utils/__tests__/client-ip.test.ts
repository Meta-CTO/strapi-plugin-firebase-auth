import { describe, it, expect } from "vitest";
import { getClientIP } from "../client-ip";

const ctx = (headers: Record<string, string | string[] | undefined>, ip?: string) => ({
  request: { headers, ip },
});

describe("getClientIP", () => {
  it("prefers the first x-forwarded-for entry", () => {
    expect(getClientIP(ctx({ "x-forwarded-for": "1.1.1.1, 2.2.2.2" }, "9.9.9.9"))).toBe("1.1.1.1");
  });

  it("accepts an array x-forwarded-for", () => {
    expect(getClientIP(ctx({ "x-forwarded-for": ["3.3.3.3", "4.4.4.4"] }))).toBe("3.3.3.3");
  });

  it("falls back to x-real-ip", () => {
    expect(getClientIP(ctx({ "x-real-ip": "5.5.5.5" }, "9.9.9.9"))).toBe("5.5.5.5");
  });

  it("accepts an array x-real-ip", () => {
    expect(getClientIP(ctx({ "x-real-ip": ["6.6.6.6", "7.7.7.7"] }, "9.9.9.9"))).toBe("6.6.6.6");
  });

  it("falls back to ctx.request.ip, then unknown", () => {
    expect(getClientIP(ctx({}, "9.9.9.9"))).toBe("9.9.9.9");
    expect(getClientIP(ctx({}))).toBe("unknown");
  });

  it("ignores forwarded headers and uses ctx.request.ip when a proxy is configured", () => {
    expect(
      getClientIP(ctx({ "x-forwarded-for": "1.1.1.1", "x-real-ip": "5.5.5.5" }, "9.9.9.9"), {
        proxyConfigured: true,
      })
    ).toBe("9.9.9.9");
    expect(getClientIP(ctx({}), { proxyConfigured: true })).toBe("unknown");
  });
});

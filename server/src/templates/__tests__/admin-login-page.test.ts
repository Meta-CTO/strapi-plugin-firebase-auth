import { describe, it, expect } from "vitest";
import { renderAdminLoginPage, buildAdminLoginCsp, FIREBASE_COMPAT_VERSION } from "../admin-login-page";

const options = {
  nonce: "abc123",
  configUrl: "/api/firebase-authentication/config",
  loginUrl: "/api/firebase-authentication/admin-login",
  adminUrl: "/admin",
};

describe("renderAdminLoginPage", () => {
  const html = renderAdminLoginPage(options);

  it("is a full HTML document", () => {
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("</html>");
  });

  it("loads the Firebase compat SDK from gstatic at the pinned version", () => {
    expect(html).toContain(
      `https://www.gstatic.com/firebasejs/${FIREBASE_COMPAT_VERSION}/firebase-app-compat.js`
    );
    expect(html).toContain(
      `https://www.gstatic.com/firebasejs/${FIREBASE_COMPAT_VERSION}/firebase-auth-compat.js`
    );
  });

  it("carries the nonce on every script and style tag", () => {
    const scripts = html.match(/<script\b[^>]*>/g) ?? [];
    const styles = html.match(/<style\b[^>]*>/g) ?? [];
    expect(scripts.length).toBeGreaterThan(0);
    expect(styles.length).toBeGreaterThan(0);
    for (const tag of [...scripts, ...styles]) {
      expect(tag).toContain('nonce="abc123"');
    }
  });

  it("embeds the URLs as JSON, escaped for safe inlining", () => {
    const html2 = renderAdminLoginPage({ ...options, adminUrl: "/admin</script><script>alert(1)" });
    expect(html2).not.toContain("</script><script>alert(1)");
    expect(html2).toContain("\\u003c/script");
  });

  it("writes the Strapi admin storage keys and redirects", () => {
    expect(html).toContain('localStorage.setItem("jwtToken", JSON.stringify(');
    expect(html).toContain('localStorage.setItem("isLoggedIn", "true")');
    expect(html).toContain("window.location.assign(");
  });

  it("posts the id token with credentials included", () => {
    expect(html).toContain('credentials: "include"');
    expect(html).toContain("idToken");
    expect(html).toContain("deviceId");
    expect(html).toContain("rememberMe");
  });

  it("offers Google and email/password sign-in and a remember-me checkbox", () => {
    expect(html).toContain("GoogleAuthProvider");
    expect(html).toContain("signInWithEmailAndPassword");
    expect(html).toContain('id="remember"');
  });
});

describe("buildAdminLoginCsp", () => {
  const csp = buildAdminLoginCsp("abc123");

  it("allows only self, the nonce and gstatic/apis.google for scripts", () => {
    expect(csp).toContain("script-src 'self' 'nonce-abc123' https://www.gstatic.com https://apis.google.com");
  });

  it("allows Firebase auth endpoints for connections and frames", () => {
    expect(csp).toContain(
      "connect-src 'self' https://*.googleapis.com https://*.firebaseapp.com https://*.google.com"
    );
    expect(csp).toContain("frame-src https://*.firebaseapp.com https://accounts.google.com");
  });

  it("locks down the rest", () => {
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("style-src 'nonce-abc123'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("object-src 'none'");
  });
});

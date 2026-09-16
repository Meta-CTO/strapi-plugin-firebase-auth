# Firebase Admin Panel Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Strapi administrators sign in to `/admin` with Firebase, through a plugin-served page and a plugin endpoint that mints a real Strapi admin session, on Community Edition.

**Architecture:** A pure authorization function decides who may log in from the decoded Firebase token and the plugin config. A service resolves or creates the Strapi admin and mints the session via `strapi.sessionManager('admin')`. A controller serves a self-contained HTML sign-in page and the POST login endpoint, sets the `strapi_admin_refresh` cookie exactly like core login, and writes to the plugin's activity log. Rate limiting is an in-plugin middleware so the plugin never depends on an admin-namespaced middleware being resolvable at boot.

**Tech Stack:** Strapi 5 plugin (TypeScript, `@strapi/sdk-plugin` build), `firebase-admin` (already a dependency), Vitest for unit tests, Firebase Web SDK compat build loaded from `https://www.gstatic.com` in the page.

**Spec:** `docs/superpowers/specs/2026-09-14-firebase-admin-login-design.md`

## Global Constraints

- Runtime floor for the feature: Strapi 5.24.0 (`strapi.sessionManager` exists). Detect at runtime; do not bump `peerDependencies` (`"@strapi/strapi": "^5.0.0"` stays).
- Feature is off by default: `adminLogin.enabled` defaults to `false`; both routes return 404 when off.
- Admin-access settings live only in plugin config (`config/plugins.ts`), never in the database.
- Fixed custom claim name: `strapiAdmin`. Fixed route path: `/api/firebase-authentication/admin-login` (GET page, POST login).
- Refresh cookie name `strapi_admin_refresh`; response body `{ data: { token, accessToken, user } }`; page handoff writes `localStorage.jwtToken` (JSON string) and `localStorage.isLoggedIn = 'true'`.
- Do not pass `metadata` to `generateRefreshToken` (keeps 5.24 to 5.52 compatible).
- All 403 denials return the same client message: `You are not authorized to access the admin panel`.
- Prettier: `endOfLine: lf`, `printWidth: 110`, double quotes, semicolons. Run `npm run format` before each commit.
- Commit only explicit paths. Never `git add -A` (an untracked `.claude/` directory exists and must not be committed).
- npm in this environment: the shell shims recurse. Use the binary directly: `~/.nvm/versions/node/v22.23.2/bin/npm`. Below, `NPM` means that path.
- No emoji in any file written to disk.

---

## File structure

| Path | Responsibility |
| --- | --- |
| `vitest.config.ts` (new) | Test runner config, node environment, `server/src/**/*.test.ts` |
| `server/tsconfig.json` (modify) | Exclude test files from the plugin type-check |
| `package.json` (modify) | `vitest` dev dependency, `test` script |
| `server/src/config/index.ts` (modify) | `AdminLoginConfig` type, defaults, validator rules |
| `server/src/utils/admin-login-authorize.ts` (new) | Pure: `authorizeAdminLogin`, `splitDisplayName`, `normalizeAdminLoginConfig`, `ADMIN_CLAIM` |
| `server/src/utils/admin-session-cookie.ts` (new) | Pure with injected `strapi`: `REFRESH_COOKIE_NAME`, `buildRefreshCookieOptions` |
| `server/src/utils/client-ip.ts` (new) | `getClientIP(ctx)` shared by the activity-logger middleware and the new controller |
| `server/src/middlewares/activity-logger.ts` (modify) | Import `getClientIP` from the shared util instead of its private copy |
| `server/src/middlewares/admin-login-rate-limit.ts` (new) | Route middleware: 5 requests per 5 minutes per IP, in memory |
| `server/src/middlewares/index.ts` (modify) | Register `admin-login-rate-limit` |
| `server/src/services/adminLoginService.ts` (new) | `getConfig`, `isAvailable`, `authorize`, `resolveAdminUser`, `createSession` |
| `server/src/services/index.ts` (modify) | Register `adminLoginService` |
| `server/src/templates/admin-login-page.ts` (new) | `renderAdminLoginPage(options)`, `buildAdminLoginCsp(nonce)` |
| `server/src/controllers/adminLoginController.ts` (new) | `page(ctx)`, `login(ctx)`, error mapping, activity log |
| `server/src/controllers/index.ts` (modify) | Register `adminLoginController` |
| `server/src/routes/content-api.ts` (modify) | Add GET and POST `/admin-login` |
| `server/src/bootstrap.ts` (modify) | Startup warnings for the admin-login config |
| `README.md` (modify) | New section "Admin panel login with Firebase" |
| `docs/superpowers/specs/2026-09-14-firebase-admin-login-design.md` (modify) | Amend rate-limit paragraph (in-plugin limiter instead of `admin::rateLimit`) |

Tests live next to the code in `__tests__` folders: `server/src/utils/__tests__/`, `server/src/services/__tests__/`, `server/src/controllers/__tests__/`, `server/src/middlewares/__tests__/`, `server/src/templates/__tests__/`, `server/src/config/__tests__/`.

---

### Task 1: Test tooling (Vitest)

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (scripts, devDependencies)
- Modify: `server/tsconfig.json`
- Test: `server/src/utils/__tests__/smoke.test.ts` (deleted again in Task 2)

**Interfaces:**
- Produces: `NPM test` runs Vitest once over `server/src/**/*.test.ts`.

- [ ] **Step 1: Install dependencies and Vitest**

Run:
```bash
cd /Users/felippe/Projects/Work/Firebase/strapi-plugin-firebase-auth
NPM=~/.nvm/versions/node/v22.23.2/bin/npm
$NPM install
$NPM install --save-dev vitest
git diff --stat package.json package-lock.json
```
Expected: `node_modules/` exists, `package.json` gains `"vitest"` under `devDependencies`, lock file updated.

- [ ] **Step 2: Add the config file**

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["server/src/**/*.test.ts"],
    clearMocks: true,
  },
});
```

- [ ] **Step 3: Add the test script**

Edit `package.json` `scripts`, add after `"format:check"`:
```json
"test": "vitest run",
"test:watch": "vitest",
```

- [ ] **Step 4: Exclude tests from the plugin type-check**

Edit `server/tsconfig.json` to:
```json
{
  "extends": ["@strapi/typescript-utils/tsconfigs/server", "../tsconfig.json"],
  "include": ["./src"],
  "exclude": ["./src/**/*.test.ts", "./src/**/__tests__/**"],
  "compilerOptions": {
    "rootDir": "../",
    "baseUrl": ".",
    "skipLibCheck": true,
    "types": []
  }
}
```

- [ ] **Step 5: Write a smoke test**

Create `server/src/utils/__tests__/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("vitest wiring", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Run it**

Run: `$NPM test`
Expected: `1 passed`.

- [ ] **Step 7: Confirm the type-check and build still pass**

Run: `$NPM run test:ts:back && $NPM run build && ls dist/server`
Expected: no TypeScript errors; `dist/server/index.js` exists. Test files are not in `dist`.

- [ ] **Step 8: Commit**

```bash
$NPM run format
git add vitest.config.ts package.json package-lock.json server/tsconfig.json server/src/utils/__tests__/smoke.test.ts
git commit -m "chore: add vitest test runner

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Plugin config for `adminLogin`

**Files:**
- Modify: `server/src/config/index.ts`
- Create: `server/src/utils/admin-login-authorize.ts` (only `normalizeAdminLoginConfig` and the type in this task)
- Test: `server/src/config/__tests__/admin-login-config.test.ts`
- Delete: `server/src/utils/__tests__/smoke.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type AdminLoginConfig = {
    enabled: boolean;
    allowedEmails: string[];
    allowedDomains: string[];
    autoCreateRole: string | null;
  };
  export const DEFAULT_ADMIN_LOGIN_CONFIG: AdminLoginConfig;
  export function normalizeAdminLoginConfig(raw: unknown): AdminLoginConfig; // trims, lowercases, strips leading "@" from domains, drops empties
  ```
  `FirebaseAuthConfig.adminLogin?: Partial<AdminLoginConfig>`.

- [ ] **Step 1: Write the failing tests**

Create `server/src/config/__tests__/admin-login-config.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import config from "../index";
import { normalizeAdminLoginConfig, DEFAULT_ADMIN_LOGIN_CONFIG } from "../../utils/admin-login-authorize";

const env = Object.assign((key: string, fallback?: unknown) => process.env[key] ?? fallback, {
  bool: (key: string, fallback: boolean) => (process.env[key] === undefined ? fallback : process.env[key] === "true"),
  int: (key: string, fallback: number | null) => (process.env[key] === undefined ? fallback : Number(process.env[key])),
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
```

- [ ] **Step 2: Run to verify failure**

Run: `$NPM test -- server/src/config`
Expected: FAIL, `Cannot find module '../../utils/admin-login-authorize'` and `adminLogin` undefined.

- [ ] **Step 3: Create the normalizer and type**

Create `server/src/utils/admin-login-authorize.ts`:
```ts
export type AdminLoginConfig = {
  enabled: boolean;
  allowedEmails: string[];
  allowedDomains: string[];
  autoCreateRole: string | null;
};

export const DEFAULT_ADMIN_LOGIN_CONFIG: AdminLoginConfig = {
  enabled: false,
  allowedEmails: [],
  allowedDomains: [],
  autoCreateRole: null,
};

const cleanList = (value: unknown, stripAt: boolean): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().toLowerCase())
    .map((item) => (stripAt && item.startsWith("@") ? item.slice(1) : item))
    .filter((item) => item.length > 0);
};

/**
 * Normalize the raw adminLogin config block from config/plugins.ts.
 * Missing or malformed values fall back to the safe defaults (feature off, nobody allowed).
 */
export function normalizeAdminLoginConfig(raw: unknown): AdminLoginConfig {
  const block = (raw ?? {}) as Partial<Record<keyof AdminLoginConfig, unknown>>;
  const role = typeof block.autoCreateRole === "string" ? block.autoCreateRole.trim() : "";
  return {
    enabled: block.enabled === true,
    allowedEmails: cleanList(block.allowedEmails, false),
    allowedDomains: cleanList(block.allowedDomains, true),
    autoCreateRole: role.length > 0 ? role : null,
  };
}
```

- [ ] **Step 4: Add the config type, defaults and validator rules**

Edit `server/src/config/index.ts`.

Add the import at the top of the file:
```ts
import type { AdminLoginConfig } from "../utils/admin-login-authorize";
```

Add to the `FirebaseAuthConfig` type, after `activityLogRetentionDays`:
```ts
  /**
   * Admin panel login with Firebase. Off by default.
   * Settings live only here (never in the database) because they decide who can become an admin.
   *
   * @example
   * adminLogin: {
   *   enabled: env.bool("FIREBASE_ADMIN_LOGIN_ENABLED", false),
   *   allowedDomains: ["example.com"],
   *   autoCreateRole: "strapi-editor",
   * }
   */
  adminLogin?: Partial<AdminLoginConfig>;
```

Add to the `default` factory, after `activityLogRetentionDays`:
```ts
    adminLogin: {
      enabled: env.bool("FIREBASE_ADMIN_LOGIN_ENABLED", false),
      allowedEmails: [],
      allowedDomains: [],
      autoCreateRole: null,
    },
```

Add to the end of `validator`, before its closing brace:
```ts
    if (config.adminLogin !== undefined) {
      const block = config.adminLogin as Record<string, unknown>;
      const isStringArray = (value: unknown) =>
        Array.isArray(value) && value.every((item) => typeof item === "string");

      if (block.enabled !== undefined && typeof block.enabled !== "boolean") {
        throw new Error("[Firebase Auth Plugin] adminLogin.enabled must be a boolean");
      }
      if (block.allowedEmails !== undefined && !isStringArray(block.allowedEmails)) {
        throw new Error("[Firebase Auth Plugin] adminLogin.allowedEmails must be an array of strings");
      }
      if (block.allowedDomains !== undefined && !isStringArray(block.allowedDomains)) {
        throw new Error("[Firebase Auth Plugin] adminLogin.allowedDomains must be an array of strings");
      }
      if (
        block.autoCreateRole !== undefined &&
        block.autoCreateRole !== null &&
        typeof block.autoCreateRole !== "string"
      ) {
        throw new Error("[Firebase Auth Plugin] adminLogin.autoCreateRole must be a role code string or null");
      }
    }
```

- [ ] **Step 5: Run the tests**

Run: `$NPM test -- server/src/config`
Expected: all PASS.

- [ ] **Step 6: Remove the smoke test, type-check, commit**

```bash
git rm -q server/src/utils/__tests__/smoke.test.ts
$NPM run test:ts:back
$NPM run format
git add server/src/config/index.ts server/src/utils/admin-login-authorize.ts server/src/config/__tests__/admin-login-config.test.ts
git commit -m "feat(admin-login): add adminLogin plugin config with validation

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Pure authorization logic

**Files:**
- Modify: `server/src/utils/admin-login-authorize.ts`
- Test: `server/src/utils/__tests__/admin-login-authorize.test.ts`

**Interfaces:**
- Consumes: `AdminLoginConfig` from Task 2.
- Produces:
  ```ts
  export const ADMIN_CLAIM = "strapiAdmin";
  export type AuthorizeResult =
    | { allowed: true; via: "email" | "domain" | "claim"; email: string }
    | { allowed: false; reason: "email_missing" | "email_unverified" | "not_allowlisted" };
  export type AdminLoginToken = { uid: string; email?: string; email_verified?: boolean; name?: string } & Record<string, unknown>;
  export function authorizeAdminLogin(token: AdminLoginToken, config: AdminLoginConfig): AuthorizeResult;
  export function splitDisplayName(name: string | undefined, email: string): { firstname: string; lastname: string };
  ```

- [ ] **Step 1: Write the failing tests**

Create `server/src/utils/__tests__/admin-login-authorize.test.ts`:
```ts
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
    expect(authorizeAdminLogin(token({ email: undefined }), config({ allowedDomains: ["metacto.com"] }))).toEqual({
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
    expect(authorizeAdminLogin(token({ email: "x@evilmetacto.com" }), config({ allowedDomains: ["metacto.com"] }))).toEqual({
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
```

- [ ] **Step 2: Run to verify failure**

Run: `$NPM test -- server/src/utils`
Expected: FAIL, `authorizeAdminLogin is not a function`.

- [ ] **Step 3: Implement**

Append to `server/src/utils/admin-login-authorize.ts`:
```ts
export const ADMIN_CLAIM = "strapiAdmin";

export type AdminLoginToken = {
  uid: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
} & Record<string, unknown>;

export type AuthorizeResult =
  | { allowed: true; via: "email" | "domain" | "claim"; email: string }
  | { allowed: false; reason: "email_missing" | "email_unverified" | "not_allowlisted" };

/**
 * Decide whether a verified Firebase user may log into the Strapi admin panel.
 * Pure function: no I/O, no strapi access. Order of checks:
 *   1. email present            -> else email_missing
 *   2. email verified           -> else email_unverified
 *   3. exact email allowlisted  -> via "email"
 *   4. email domain allowlisted -> via "domain"
 *   5. custom claim truthy      -> via "claim"
 *   6. otherwise                -> not_allowlisted
 */
export function authorizeAdminLogin(token: AdminLoginToken, config: AdminLoginConfig): AuthorizeResult {
  const rawEmail = typeof token.email === "string" ? token.email.trim().toLowerCase() : "";
  if (!rawEmail) {
    return { allowed: false, reason: "email_missing" };
  }
  if (token.email_verified !== true) {
    return { allowed: false, reason: "email_unverified" };
  }

  if (config.allowedEmails.includes(rawEmail)) {
    return { allowed: true, via: "email", email: rawEmail };
  }

  const at = rawEmail.lastIndexOf("@");
  const domain = at >= 0 ? rawEmail.slice(at + 1) : "";
  if (domain && config.allowedDomains.includes(domain)) {
    return { allowed: true, via: "domain", email: rawEmail };
  }

  if (token[ADMIN_CLAIM]) {
    return { allowed: true, via: "claim", email: rawEmail };
  }

  return { allowed: false, reason: "not_allowlisted" };
}

/**
 * Strapi admin users require both firstname and lastname.
 * Derive them from the Firebase display name, falling back to the email local part.
 */
export function splitDisplayName(name: string | undefined, email: string): { firstname: string; lastname: string } {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    const local = email.split("@")[0] || email;
    return { firstname: local, lastname: "-" };
  }
  const [firstname, ...rest] = words;
  return { firstname, lastname: rest.length > 0 ? rest.join(" ") : "-" };
}
```

- [ ] **Step 4: Run the tests**

Run: `$NPM test -- server/src/utils`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
$NPM run format
git add server/src/utils/admin-login-authorize.ts server/src/utils/__tests__/admin-login-authorize.test.ts
git commit -m "feat(admin-login): pure authorization rules for Firebase admin login

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Refresh-cookie options mirroring Strapi core

**Files:**
- Create: `server/src/utils/admin-session-cookie.ts`
- Test: `server/src/utils/__tests__/admin-session-cookie.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const REFRESH_COOKIE_NAME = "strapi_admin_refresh";
  export type RefreshCookieOptions = {
    httpOnly: true; secure: boolean; overwrite: true; domain?: string; path: string;
    sameSite: boolean | "lax" | "strict" | "none"; maxAge?: number; expires?: Date;
  };
  export type CookieStrapi = { config: { get: (key: string, fallback?: unknown) => unknown }; log: { warn: (message: string) => void } };
  export function buildRefreshCookieOptions(strapi: CookieStrapi, type: "refresh" | "session", absoluteExpiresAtISO?: string, secureRequest?: boolean): RefreshCookieOptions;
  ```

Reference behaviour (Strapi v5.53.0 `packages/core/admin/shared/utils/session-auth.ts`, `auth-cookie-domain.ts`, `auth-cookie-path.ts`):
- domain: `admin.auth.cookie.domain` || `admin.auth.domain`; invalid (contains control chars, `; , whitespace / :`) -> warn and use undefined.
- path: `admin.auth.cookie.path`, default `/admin`; must start with `/` and contain no control chars or `;`, else warn and use `/admin`.
- sameSite: `admin.auth.cookie.sameSite` ?? `lax`.
- secure: `admin.auth.cookie.secure` if boolean; else `isProduction && secureRequest` when `secureRequest` given; else `isProduction`.
- type `session`: no expiry. Type `refresh`: `expires = min(now + idleRefreshTokenLifespan, absoluteExpiresAt)`, `maxAge = expires - now`, idle default `14 * 24 * 60 * 60` seconds from `admin.auth.sessions.idleRefreshTokenLifespan`.

- [ ] **Step 1: Write the failing tests**

Create `server/src/utils/__tests__/admin-session-cookie.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildRefreshCookieOptions, REFRESH_COOKIE_NAME } from "../admin-session-cookie";

const makeStrapi = (values: Record<string, unknown> = {}) => ({
  config: {
    get: vi.fn((key: string, fallback?: unknown) => (key in values ? values[key] : fallback)),
  },
  log: { warn: vi.fn() },
});

describe("admin-session-cookie", () => {
  const originalEnv = process.env.NODE_ENV;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T12:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
    process.env.NODE_ENV = originalEnv;
  });

  it("uses the core cookie name", () => {
    expect(REFRESH_COOKIE_NAME).toBe("strapi_admin_refresh");
  });

  it("applies Strapi defaults for a session cookie outside production", () => {
    process.env.NODE_ENV = "test";
    const opts = buildRefreshCookieOptions(makeStrapi(), "session");
    expect(opts).toEqual({
      httpOnly: true,
      secure: false,
      overwrite: true,
      domain: undefined,
      path: "/admin",
      sameSite: "lax",
      maxAge: undefined,
    });
  });

  it("reads domain, path and sameSite from admin.auth.cookie.*", () => {
    const opts = buildRefreshCookieOptions(
      makeStrapi({
        "admin.auth.cookie.domain": "example.com",
        "admin.auth.cookie.path": "/strapi/admin",
        "admin.auth.cookie.sameSite": "strict",
      }),
      "session"
    );
    expect(opts).toMatchObject({ domain: "example.com", path: "/strapi/admin", sameSite: "strict" });
  });

  it("falls back to admin.auth.domain for the domain", () => {
    const opts = buildRefreshCookieOptions(makeStrapi({ "admin.auth.domain": "example.com" }), "session");
    expect(opts.domain).toBe("example.com");
  });

  it("ignores an invalid domain with a warning", () => {
    const strapi = makeStrapi({ "admin.auth.cookie.domain": "https://bad.com/path" });
    const opts = buildRefreshCookieOptions(strapi, "session");
    expect(opts.domain).toBeUndefined();
    expect(strapi.log.warn).toHaveBeenCalledWith(expect.stringContaining("invalid admin auth cookie domain"));
  });

  it("ignores an invalid path with a warning", () => {
    const strapi = makeStrapi({ "admin.auth.cookie.path": "admin;evil" });
    const opts = buildRefreshCookieOptions(strapi, "session");
    expect(opts.path).toBe("/admin");
    expect(strapi.log.warn).toHaveBeenCalledWith(expect.stringContaining("invalid admin auth cookie path"));
  });

  it("honours an explicit boolean admin.auth.cookie.secure", () => {
    process.env.NODE_ENV = "production";
    expect(buildRefreshCookieOptions(makeStrapi({ "admin.auth.cookie.secure": false }), "session", undefined, true).secure).toBe(false);
    process.env.NODE_ENV = "test";
    expect(buildRefreshCookieOptions(makeStrapi({ "admin.auth.cookie.secure": true }), "session").secure).toBe(true);
  });

  it("in production, secure follows the request when secureRequest is given", () => {
    process.env.NODE_ENV = "production";
    expect(buildRefreshCookieOptions(makeStrapi(), "session", undefined, true).secure).toBe(true);
    expect(buildRefreshCookieOptions(makeStrapi(), "session", undefined, false).secure).toBe(false);
    expect(buildRefreshCookieOptions(makeStrapi(), "session").secure).toBe(true);
  });

  it("refresh cookies expire at the idle lifespan when absolute expiry is later", () => {
    const now = Date.now();
    const absolute = new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();
    const opts = buildRefreshCookieOptions(makeStrapi(), "refresh", absolute);
    const fourteenDays = 14 * 24 * 60 * 60 * 1000;
    expect(opts.expires?.getTime()).toBe(now + fourteenDays);
    expect(opts.maxAge).toBe(fourteenDays);
  });

  it("refresh cookies expire at the absolute expiry when it is sooner", () => {
    const now = Date.now();
    const absolute = new Date(now + 60 * 1000).toISOString();
    const opts = buildRefreshCookieOptions(makeStrapi(), "refresh", absolute);
    expect(opts.expires?.getTime()).toBe(now + 60 * 1000);
    expect(opts.maxAge).toBe(60 * 1000);
  });

  it("uses admin.auth.sessions.idleRefreshTokenLifespan when configured", () => {
    const now = Date.now();
    const opts = buildRefreshCookieOptions(
      makeStrapi({ "admin.auth.sessions.idleRefreshTokenLifespan": 3600 }),
      "refresh",
      new Date(now + 10 * 24 * 60 * 60 * 1000).toISOString()
    );
    expect(opts.maxAge).toBe(3600 * 1000);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `$NPM test -- server/src/utils/__tests__/admin-session-cookie`
Expected: FAIL, cannot find module `../admin-session-cookie`.

- [ ] **Step 3: Implement**

Create `server/src/utils/admin-session-cookie.ts`:
```ts
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
  sameSite: (strapi.config.get("admin.auth.cookie.sameSite") as RefreshCookieOptions["sameSite"] | undefined) ?? "lax",
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
    strapi.config.get("admin.auth.sessions.idleRefreshTokenLifespan", DEFAULT_IDLE_REFRESH_TOKEN_LIFESPAN_SECONDS)
  );
  const now = Date.now();
  const idleExpiry = now + idleSeconds * 1000;
  const absoluteExpiry = absoluteExpiresAtISO ? new Date(absoluteExpiresAtISO).getTime() : idleExpiry;
  const chosen = new Date(Math.min(idleExpiry, absoluteExpiry));

  return { ...base, expires: chosen, maxAge: Math.max(0, chosen.getTime() - now) };
}
```

- [ ] **Step 4: Run the tests**

Run: `$NPM test -- server/src/utils`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
$NPM run format
git add server/src/utils/admin-session-cookie.ts server/src/utils/__tests__/admin-session-cookie.test.ts
git commit -m "feat(admin-login): mirror Strapi refresh-cookie options

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Shared client IP helper

**Files:**
- Create: `server/src/utils/client-ip.ts`
- Modify: `server/src/middlewares/activity-logger.ts` (remove the private `getClientIP`, import the shared one)
- Test: `server/src/utils/__tests__/client-ip.test.ts`

**Interfaces:**
- Produces: `export function getClientIP(ctx: { request: { headers: Record<string, string | string[] | undefined>; ip?: string } }): string;`

- [ ] **Step 1: Write the failing tests**

Create `server/src/utils/__tests__/client-ip.test.ts`:
```ts
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

  it("falls back to ctx.request.ip, then unknown", () => {
    expect(getClientIP(ctx({}, "9.9.9.9"))).toBe("9.9.9.9");
    expect(getClientIP(ctx({}))).toBe("unknown");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `$NPM test -- server/src/utils/__tests__/client-ip`
Expected: FAIL, cannot find module.

- [ ] **Step 3: Implement**

Create `server/src/utils/client-ip.ts`:
```ts
type HeaderValue = string | string[] | undefined;

export type ClientIpContext = {
  request: { headers: Record<string, HeaderValue>; ip?: string };
};

/**
 * Best-effort client IP: x-forwarded-for (first hop), then x-real-ip, then Koa's ctx.request.ip.
 */
export function getClientIP(ctx: ClientIpContext): string {
  const forwardedFor = ctx.request.headers["x-forwarded-for"];
  if (forwardedFor) {
    const first = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    return first.split(",")[0].trim();
  }

  const realIP = ctx.request.headers["x-real-ip"];
  if (realIP) {
    return Array.isArray(realIP) ? realIP[0] : realIP;
  }

  return ctx.request.ip || "unknown";
}
```

- [ ] **Step 4: Point the middleware at the shared helper**

Edit `server/src/middlewares/activity-logger.ts`:
- Add near the other imports: `import { getClientIP } from "../utils/client-ip";`
- Delete the private `function getClientIP(ctx: Koa.Context): string { ... }` block (the one that reads `x-forwarded-for`, `x-real-ip`, `ctx.request.ip`). Leave the call site `const clientIP = getClientIP(ctx);` unchanged.

- [ ] **Step 5: Run tests and type-check**

Run: `$NPM test && $NPM run test:ts:back`
Expected: all PASS, no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
$NPM run format
git add server/src/utils/client-ip.ts server/src/utils/__tests__/client-ip.test.ts server/src/middlewares/activity-logger.ts
git commit -m "refactor: share getClientIP helper between middleware and controllers

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: In-plugin rate-limit middleware

**Files:**
- Create: `server/src/middlewares/admin-login-rate-limit.ts`
- Modify: `server/src/middlewares/index.ts`
- Test: `server/src/middlewares/__tests__/admin-login-rate-limit.test.ts`

**Interfaces:**
- Consumes: `getClientIP` from Task 5.
- Produces: plugin middleware `plugin::firebase-authentication.admin-login-rate-limit`, factory signature `(config: { max?: number; windowMs?: number }, { strapi }) => (ctx, next) => Promise<void>`. Default `max = 5`, `windowMs = 5 * 60 * 1000`. Over the limit: `429` with body `{ error: { status: 429, name: "TooManyRequestsError", message: "Too many attempts, please try again later" } }`. Exported for tests: `createAdminLoginRateLimiter(options)` returning `{ middleware, reset }`.

Why not `admin::rateLimit`: referencing a middleware from another namespace fails at boot if it cannot be resolved, which would break the whole plugin for every install. An in-plugin limiter has no such dependency.

- [ ] **Step 1: Write the failing tests**

Create `server/src/middlewares/__tests__/admin-login-rate-limit.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createAdminLoginRateLimiter } from "../admin-login-rate-limit";

const makeCtx = (ip: string) => ({
  request: { headers: {}, ip },
  status: 200,
  body: undefined as unknown,
  set: vi.fn(),
});

describe("admin-login rate limiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T12:00:00.000Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("allows up to max requests per IP inside the window, then returns 429", async () => {
    const { middleware } = createAdminLoginRateLimiter({ max: 3, windowMs: 60_000 });
    const next = vi.fn(async () => {});

    for (let i = 0; i < 3; i += 1) {
      const ctx = makeCtx("1.1.1.1");
      await middleware(ctx as never, next);
      expect(ctx.status).toBe(200);
    }
    expect(next).toHaveBeenCalledTimes(3);

    const blocked = makeCtx("1.1.1.1");
    await middleware(blocked as never, next);
    expect(next).toHaveBeenCalledTimes(3);
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({
      error: { status: 429, name: "TooManyRequestsError", message: "Too many attempts, please try again later" },
    });
    expect(blocked.set).toHaveBeenCalledWith("Retry-After", "60");
  });

  it("tracks IPs independently", async () => {
    const { middleware } = createAdminLoginRateLimiter({ max: 1, windowMs: 60_000 });
    const next = vi.fn(async () => {});
    await middleware(makeCtx("1.1.1.1") as never, next);
    const other = makeCtx("2.2.2.2");
    await middleware(other as never, next);
    expect(other.status).toBe(200);
    expect(next).toHaveBeenCalledTimes(2);
  });

  it("forgets attempts after the window passes", async () => {
    const { middleware } = createAdminLoginRateLimiter({ max: 1, windowMs: 60_000 });
    const next = vi.fn(async () => {});
    await middleware(makeCtx("1.1.1.1") as never, next);
    vi.advanceTimersByTime(60_001);
    const again = makeCtx("1.1.1.1");
    await middleware(again as never, next);
    expect(again.status).toBe(200);
    expect(next).toHaveBeenCalledTimes(2);
  });

  it("uses x-forwarded-for when present", async () => {
    const { middleware } = createAdminLoginRateLimiter({ max: 1, windowMs: 60_000 });
    const next = vi.fn(async () => {});
    const first = { ...makeCtx("9.9.9.9"), request: { headers: { "x-forwarded-for": "7.7.7.7" }, ip: "9.9.9.9" } };
    const second = { ...makeCtx("8.8.8.8"), request: { headers: { "x-forwarded-for": "7.7.7.7" }, ip: "8.8.8.8" } };
    await middleware(first as never, next);
    await middleware(second as never, next);
    expect(second.status).toBe(429);
  });

  it("defaults to 5 attempts per 5 minutes", async () => {
    const { middleware } = createAdminLoginRateLimiter();
    const next = vi.fn(async () => {});
    for (let i = 0; i < 5; i += 1) await middleware(makeCtx("1.1.1.1") as never, next);
    const blocked = makeCtx("1.1.1.1");
    await middleware(blocked as never, next);
    expect(blocked.status).toBe(429);
    expect(blocked.set).toHaveBeenCalledWith("Retry-After", "300");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `$NPM test -- server/src/middlewares`
Expected: FAIL, cannot find module.

- [ ] **Step 3: Implement**

Create `server/src/middlewares/admin-login-rate-limit.ts`:
```ts
import type { Core } from "@strapi/strapi";
import type Koa from "koa";
import { getClientIP } from "../utils/client-ip";

export type AdminLoginRateLimitOptions = {
  /** Attempts allowed per IP inside one window. Default 5. */
  max?: number;
  /** Window length in milliseconds. Default 5 minutes. */
  windowMs?: number;
};

const DEFAULT_MAX = 5;
const DEFAULT_WINDOW_MS = 5 * 60 * 1000;

type Bucket = { count: number; windowStart: number };

/**
 * Fixed-window, per-IP limiter kept in process memory.
 * Good enough for an admin login endpoint on a single instance; a multi-instance
 * deployment gets a per-instance limit, which is still a meaningful brake.
 */
export function createAdminLoginRateLimiter(options: AdminLoginRateLimitOptions = {}) {
  const max = options.max ?? DEFAULT_MAX;
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const buckets = new Map<string, Bucket>();

  const sweep = (now: number) => {
    for (const [key, bucket] of buckets) {
      if (now - bucket.windowStart >= windowMs) buckets.delete(key);
    }
  };

  const middleware = async (ctx: Koa.Context, next: Koa.Next) => {
    const now = Date.now();
    if (buckets.size > 1000) sweep(now);

    const ip = getClientIP(ctx);
    const bucket = buckets.get(ip);

    if (!bucket || now - bucket.windowStart >= windowMs) {
      buckets.set(ip, { count: 1, windowStart: now });
      return next();
    }

    if (bucket.count >= max) {
      const retryAfterSeconds = Math.ceil((bucket.windowStart + windowMs - now) / 1000);
      ctx.set("Retry-After", String(retryAfterSeconds));
      ctx.status = 429;
      ctx.body = {
        error: { status: 429, name: "TooManyRequestsError", message: "Too many attempts, please try again later" },
      };
      return;
    }

    bucket.count += 1;
    return next();
  };

  return { middleware, reset: () => buckets.clear() };
}

/**
 * Strapi route-middleware factory. Referenced from routes as
 * "plugin::firebase-authentication.admin-login-rate-limit".
 */
export default (config: AdminLoginRateLimitOptions, _ctx: { strapi: Core.Strapi }) =>
  createAdminLoginRateLimiter(config ?? {}).middleware;
```

- [ ] **Step 4: Register it**

Edit `server/src/middlewares/index.ts` to:
```ts
import activityLoggerFactory from "./activity-logger";
import adminLoginRateLimit from "./admin-login-rate-limit";

export default {
  "activity-logger": activityLoggerFactory,
  "admin-login-rate-limit": adminLoginRateLimit,
};
```

- [ ] **Step 5: Run tests and type-check**

Run: `$NPM test && $NPM run test:ts:back`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
$NPM run format
git add server/src/middlewares/admin-login-rate-limit.ts server/src/middlewares/index.ts server/src/middlewares/__tests__/admin-login-rate-limit.test.ts
git commit -m "feat(admin-login): per-IP rate limit middleware for the admin login route

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: `adminLoginService`

**Files:**
- Create: `server/src/services/adminLoginService.ts`
- Modify: `server/src/services/index.ts`
- Test: `server/src/services/__tests__/adminLoginService.test.ts`

**Interfaces:**
- Consumes: `normalizeAdminLoginConfig`, `authorizeAdminLogin`, `splitDisplayName`, `AdminLoginToken`, `AuthorizeResult` (Tasks 2 and 3); `buildRefreshCookieOptions`, `RefreshCookieOptions` (Task 4).
- Produces (service factory `({ strapi }) => ({...})`, accessed as `strapi.plugin("firebase-authentication").service("adminLoginService")`):
  ```ts
  getConfig(): AdminLoginConfig
  isAvailable(): { available: true } | { available: false; reason: "no_session_manager" | "firebase_not_initialized" }
  authorize(token: AdminLoginToken): AuthorizeResult
  resolveAdminUser(token: AdminLoginToken, email: string): Promise<ResolveResult>
  createSession(userId: string | number, deviceId: string, rememberMe: boolean, secureRequest?: boolean): Promise<SessionResult>
  ```
  ```ts
  export type ResolveResult =
    | { ok: true; user: AdminUserRecord; created: boolean }
    | { ok: false; reason: "inactive" | "blocked" | "not_found" | "role_not_found" };
  export type SessionResult = { refreshToken: string; accessToken: string; cookieOptions: RefreshCookieOptions; cookieType: "refresh" | "session" };
  export type AdminUserRecord = { id: number | string; email: string; isActive?: boolean; blocked?: boolean; roles?: unknown[] } & Record<string, unknown>;
  ```

Strapi APIs used (verified on v5.34.0 and v5.53.0):
- `strapi.service("admin::user").findOneByEmail(email, populate)`; `.create({ email, firstname, lastname, roles, isActive: true })`.
- `strapi.service("admin::role").findOne({ code })`.
- `strapi.sessionManager("admin").generateRefreshToken(userId: string, deviceId, { type })` -> `{ token, sessionId, absoluteExpiresAt }`.
- `strapi.sessionManager("admin").generateAccessToken(refreshToken)` -> `{ token } | { error }`.
- `strapi.firebase` is set by `settingsService.init()` (see `server/src/services/settingsService.ts:80`) and is undefined until a service account is uploaded.

- [ ] **Step 1: Write the failing tests**

Create `server/src/services/__tests__/adminLoginService.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import createService from "../adminLoginService";

type MockStrapi = ReturnType<typeof makeStrapi>;

const makeStrapi = (over: { config?: Record<string, unknown>; sessionManager?: unknown; firebase?: unknown } = {}) => {
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
    config: { get: vi.fn((key: string, fallback?: unknown) => (key in configValues ? configValues[key] : fallback)) },
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
      config: { "plugin::firebase-authentication": { adminLogin: { enabled: true, allowedDomains: ["@MetaCTO.com"] } } },
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
    expect(svc.authorize(token({ email: "x@other.com" }))).toEqual({ allowed: false, reason: "not_allowlisted" });
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
    await expect(svc.resolveAdminUser(token(), "ana@metacto.com")).resolves.toEqual({ ok: true, user, created: false });
    expect(strapi._adminUser.findOneByEmail).toHaveBeenCalledWith("ana@metacto.com", ["roles"]);
    expect(strapi._adminUser.create).not.toHaveBeenCalled();
  });

  it("denies a blocked admin", async () => {
    strapi._adminUser.findOneByEmail.mockResolvedValue({ id: 7, isActive: true, blocked: true });
    const svc = createService({ strapi: strapi as never });
    await expect(svc.resolveAdminUser(token(), "ana@metacto.com")).resolves.toEqual({ ok: false, reason: "blocked" });
  });

  it("denies an inactive admin", async () => {
    strapi._adminUser.findOneByEmail.mockResolvedValue({ id: 7, isActive: false, blocked: false });
    const svc = createService({ strapi: strapi as never });
    await expect(svc.resolveAdminUser(token(), "ana@metacto.com")).resolves.toEqual({ ok: false, reason: "inactive" });
  });

  it("denies a missing admin when auto-create is off", async () => {
    strapi._adminUser.findOneByEmail.mockResolvedValue(null);
    const svc = createService({ strapi: strapi as never });
    await expect(svc.resolveAdminUser(token(), "ana@metacto.com")).resolves.toEqual({ ok: false, reason: "not_found" });
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
    await expect(svc.resolveAdminUser(token(), "ana@metacto.com")).resolves.toEqual({ ok: true, user: created, created: true });
    expect(strapi._adminRole.findOne).toHaveBeenCalledWith({ code: "strapi-editor" });
    expect(strapi._adminUser.create).toHaveBeenCalledWith({
      email: "ana@metacto.com",
      firstname: "Ana",
      lastname: "Silva",
      roles: [3],
      isActive: true,
    });
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
    await expect(svc.resolveAdminUser(token(), "ana@metacto.com")).resolves.toEqual({ ok: false, reason: "role_not_found" });
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
        generateRefreshToken: vi.fn(async () => ({ token: "r", sessionId: "s", absoluteExpiresAt: "2026-10-15T12:00:00.000Z" })),
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
```

- [ ] **Step 2: Run to verify failure**

Run: `$NPM test -- server/src/services`
Expected: FAIL, cannot find module `../adminLoginService`.

- [ ] **Step 3: Implement**

Create `server/src/services/adminLoginService.ts`:
```ts
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
      const pluginConfig = (s.config.get("plugin::firebase-authentication") ?? {}) as { adminLogin?: unknown };
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
      const created = await userService.create({ email, firstname, lastname, roles: [role.id], isActive: true });
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

      const { token: refreshToken, absoluteExpiresAt } = await origin.generateRefreshToken(String(userId), deviceId, {
        type: cookieType,
      });

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
```

- [ ] **Step 4: Register the service**

Edit `server/src/services/index.ts`: add `import adminLoginService from "./adminLoginService";` and `adminLoginService,` to the exported object (after `activityLogService`).

- [ ] **Step 5: Run tests and type-check**

Run: `$NPM test && $NPM run test:ts:back`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
$NPM run format
git add server/src/services/adminLoginService.ts server/src/services/index.ts server/src/services/__tests__/adminLoginService.test.ts
git commit -m "feat(admin-login): service to authorize, resolve admin and mint session

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Sign-in page template and CSP

**Files:**
- Create: `server/src/templates/admin-login-page.ts`
- Test: `server/src/templates/__tests__/admin-login-page.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type AdminLoginPageOptions = { nonce: string; configUrl: string; loginUrl: string; adminUrl: string };
  export function renderAdminLoginPage(options: AdminLoginPageOptions): string;
  export function buildAdminLoginCsp(nonce: string): string;
  export const FIREBASE_COMPAT_VERSION = "10.14.1";
  ```
- Runtime contract of the page: fetches `configUrl` (existing public `GET /api/firebase-authentication/config`, which returns `{ firebaseConfig: { apiKey, authDomain, projectId } | null, ... }`), signs in with Firebase, POSTs `{ idToken, deviceId, rememberMe }` to `loginUrl` with `credentials: "include"`, then writes `localStorage.jwtToken = JSON.stringify(token)` and `localStorage.isLoggedIn = "true"` and navigates to `adminUrl`.

- [ ] **Step 1: Write the failing tests**

Create `server/src/templates/__tests__/admin-login-page.test.ts`:
```ts
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
    expect(html).toContain(`https://www.gstatic.com/firebasejs/${FIREBASE_COMPAT_VERSION}/firebase-app-compat.js`);
    expect(html).toContain(`https://www.gstatic.com/firebasejs/${FIREBASE_COMPAT_VERSION}/firebase-auth-compat.js`);
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
    expect(csp).toContain("connect-src 'self' https://*.googleapis.com https://*.firebaseapp.com https://*.google.com");
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
```

- [ ] **Step 2: Run to verify failure**

Run: `$NPM test -- server/src/templates`
Expected: FAIL, cannot find module.

- [ ] **Step 3: Implement**

Create `server/src/templates/admin-login-page.ts`:
```ts
/**
 * Self-contained sign-in page for Strapi administrators using Firebase.
 *
 * Served by adminLoginController.page at GET /api/firebase-authentication/admin-login.
 * Strapi's default Content-Security-Policy blocks third-party and inline scripts,
 * so the controller sends the header from buildAdminLoginCsp and every inline
 * <script>/<style> carries the per-request nonce.
 */

export const FIREBASE_COMPAT_VERSION = "10.14.1";

export type AdminLoginPageOptions = {
  nonce: string;
  configUrl: string;
  loginUrl: string;
  adminUrl: string;
};

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** JSON that is safe to inline inside a <script> block. */
const inlineJson = (value: unknown) =>
  JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");

export function buildAdminLoginCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://www.gstatic.com https://apis.google.com`,
    `style-src 'nonce-${nonce}'`,
    "connect-src 'self' https://*.googleapis.com https://*.firebaseapp.com https://*.google.com",
    "frame-src https://*.firebaseapp.com https://accounts.google.com",
    "img-src 'self' data: https://*.googleusercontent.com https://www.gstatic.com",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export function renderAdminLoginPage(options: AdminLoginPageOptions): string {
  const nonce = escapeHtml(options.nonce);
  const sdk = `https://www.gstatic.com/firebasejs/${FIREBASE_COMPAT_VERSION}`;
  const settings = inlineJson({
    configUrl: options.configUrl,
    loginUrl: options.loginUrl,
    adminUrl: options.adminUrl,
  });

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Admin sign in</title>
<style nonce="${nonce}">
  :root { color-scheme: light; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f6f6f9; font: 14px/1.5 system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #32324d; }
  .card { width: 100%; max-width: 380px; background: #fff; border: 1px solid #dcdce4; border-radius: 8px; padding: 32px; box-shadow: 0 1px 4px rgba(33, 33, 52, .1); box-sizing: border-box; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  p.sub { margin: 0 0 24px; color: #666687; }
  label { display: block; font-weight: 600; margin: 12px 0 4px; }
  input[type=email], input[type=password] { width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid #dcdce4; border-radius: 4px; font: inherit; }
  button { width: 100%; padding: 10px 12px; border-radius: 4px; border: 1px solid #4945ff; background: #4945ff; color: #fff; font: inherit; font-weight: 600; cursor: pointer; margin-top: 16px; }
  button.secondary { background: #fff; color: #32324d; border-color: #dcdce4; }
  button[disabled] { opacity: .6; cursor: default; }
  .divider { text-align: center; color: #8e8ea9; margin: 16px 0 0; }
  .remember { display: flex; align-items: center; gap: 8px; margin-top: 12px; font-weight: 400; }
  .error { display: none; margin-top: 16px; padding: 10px 12px; border-radius: 4px; background: #fcecea; color: #b72b1a; border: 1px solid #f5c0b8; }
  .error.show { display: block; }
</style>
</head>
<body>
<main class="card">
  <h1>Sign in to Strapi</h1>
  <p class="sub">Use your Firebase account to open the admin panel.</p>

  <button id="google" type="button" class="secondary">Continue with Google</button>

  <p class="divider">or</p>

  <form id="password-form" novalidate>
    <label for="email">Email</label>
    <input id="email" name="email" type="email" autocomplete="username" required>
    <label for="password">Password</label>
    <input id="password" name="password" type="password" autocomplete="current-password" required>
    <label class="remember"><input id="remember" type="checkbox"> Remember me</label>
    <button id="submit" type="submit">Sign in</button>
  </form>

  <div id="error" class="error" role="alert"></div>
</main>

<script nonce="${nonce}" src="${sdk}/firebase-app-compat.js"></script>
<script nonce="${nonce}" src="${sdk}/firebase-auth-compat.js"></script>
<script nonce="${nonce}">
(function () {
  var settings = ${settings};
  var errorBox = document.getElementById("error");
  var buttons = [document.getElementById("google"), document.getElementById("submit")];

  function showError(message) {
    errorBox.textContent = message;
    errorBox.classList.add("show");
  }
  function busy(state) {
    buttons.forEach(function (b) { b.disabled = state; });
  }
  function deviceId() {
    var key = "firebaseAdminLoginDeviceId";
    var existing = localStorage.getItem(key);
    if (existing) return existing;
    var id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
    localStorage.setItem(key, id);
    return id;
  }

  var authPromise = fetch(settings.configUrl, { credentials: "same-origin" })
    .then(function (res) { return res.json(); })
    .then(function (cfg) {
      if (!cfg || !cfg.firebaseConfig) {
        throw new Error("Firebase web configuration is missing. Set the Web API key in the plugin settings.");
      }
      firebase.initializeApp(cfg.firebaseConfig);
      var auth = firebase.auth();
      return auth.setPersistence(firebase.auth.Auth.Persistence.NONE).then(function () { return auth; });
    })
    .catch(function (err) {
      showError(err.message || "Could not load sign-in configuration.");
      busy(true);
      throw err;
    });

  function complete(auth, user) {
    return user.getIdToken(true).then(function (idToken) {
      return fetch(settings.loginUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          idToken: idToken,
          deviceId: deviceId(),
          rememberMe: document.getElementById("remember").checked
        })
      });
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (json) {
        auth.signOut();
        if (!res.ok) {
          var message = json && json.error && json.error.message ? json.error.message : "Sign in failed.";
          throw new Error(message);
        }
        localStorage.setItem("jwtToken", JSON.stringify(json.data.token));
        localStorage.setItem("isLoggedIn", "true");
        window.location.assign(settings.adminUrl);
      });
    });
  }

  function run(action) {
    errorBox.classList.remove("show");
    busy(true);
    return authPromise.then(function (auth) {
      return action(auth).then(function (user) { return complete(auth, user); });
    }).catch(function (err) {
      showError(err && err.message ? err.message : "Sign in failed.");
    }).then(function () { busy(false); });
  }

  document.getElementById("google").addEventListener("click", function () {
    run(function (auth) {
      return auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()).then(function (r) { return r.user; });
    });
  });

  document.getElementById("password-form").addEventListener("submit", function (event) {
    event.preventDefault();
    var email = document.getElementById("email").value.trim();
    var password = document.getElementById("password").value;
    if (!email || !password) { showError("Enter your email and password."); return; }
    run(function (auth) {
      return auth.signInWithEmailAndPassword(email, password).then(function (r) { return r.user; });
    });
  });
})();
</script>
</body>
</html>`;
}
```

- [ ] **Step 4: Run the tests**

Run: `$NPM test -- server/src/templates`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
$NPM run format
git add server/src/templates/admin-login-page.ts server/src/templates/__tests__/admin-login-page.test.ts
git commit -m "feat(admin-login): self-contained Firebase sign-in page with strict CSP

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Controller

**Files:**
- Create: `server/src/controllers/adminLoginController.ts`
- Modify: `server/src/controllers/index.ts`
- Test: `server/src/controllers/__tests__/adminLoginController.test.ts`

**Interfaces:**
- Consumes: `adminLoginService` (Task 7) via `strapi.plugin("firebase-authentication").service("adminLoginService")`; `renderAdminLoginPage`, `buildAdminLoginCsp` (Task 8); `REFRESH_COOKIE_NAME` (Task 4); `getClientIP` (Task 5); `activityLogService.logActivity` (existing).
- Produces: controller factory `({ strapi }) => ({ page(ctx), login(ctx) })` registered as `adminLoginController`.

HTTP mapping (from the spec):

| Situation | Status | Client message |
| --- | --- | --- |
| `enabled` false | 404 | `Not Found` (Koa default) |
| not available | 503 | `Admin login is unavailable` |
| `idToken` missing, verification failed, `email_missing`, `email_unverified` | 401 | `Authentication failed` |
| `not_allowlisted`, `inactive`, `blocked`, `not_found`, `role_not_found` | 403 | `You are not authorized to access the admin panel` |
| session manager error | 500 | `Internal Server Error` |
| success | 200 | `{ data: { token, accessToken, user } }` |

Activity log: `activityType: "authentication"`, `action: "admin_login" | "admin_login_denied"`, `performedByType: "admin"`, `firebaseUserId: decoded.uid` or `"unknown"` before verification, `errorMessage: reason`, `metadata: { email, reason, via, created }`.

- [ ] **Step 1: Write the failing tests**

Create `server/src/controllers/__tests__/adminLoginController.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import createController from "../adminLoginController";

const makeService = (over: Record<string, unknown> = {}) => ({
  getConfig: vi.fn(() => ({ enabled: true, allowedEmails: [], allowedDomains: ["metacto.com"], autoCreateRole: null })),
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
  const verifyIdToken = vi.fn(async () => ({ uid: "uid-1", email: "ana@metacto.com", email_verified: true }));
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

const makeCtx = (body: unknown = { idToken: "id-1", deviceId: "dev-1", rememberMe: true }) => {
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
  });

  it("returns 503 when unavailable", async () => {
    const service = makeService({ isAvailable: vi.fn(() => ({ available: false, reason: "no_session_manager" })) });
    const strapi = makeStrapi(service);
    const controller = createController({ strapi: strapi as never });
    const ctx = makeCtx();
    await controller.page(ctx as never);
    expect(ctx.status).toBe(503);
    expect(ctx.body).toEqual({ error: { status: 503, name: "ServiceUnavailableError", message: "Admin login is unavailable" } });
    expect(strapi.log.error).toHaveBeenCalledWith(expect.stringContaining("no_session_manager"));
  });

  it("serves HTML with a nonce-bearing CSP and the plugin URLs", async () => {
    const controller = createController({ strapi: makeStrapi(makeService()) as never });
    const ctx = makeCtx();
    await controller.page(ctx as never);
    expect(ctx.status).toBe(200);
    expect(ctx.type).toBe("html");
    const cspCall = (ctx.set as ReturnType<typeof vi.fn>).mock.calls.find((c) => c[0] === "Content-Security-Policy");
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
    service.getConfig.mockReturnValue({ enabled: false, allowedEmails: [], allowedDomains: [], autoCreateRole: null });
    const ctx = makeCtx();
    await createController({ strapi: strapi as never }).login(ctx as never);
    expect(ctx.status).toBe(404);
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
      expect.objectContaining({ action: "admin_login_denied", firebaseUserId: "unknown", errorMessage: "token_missing", success: false })
    );
  });

  it("returns 401 when Firebase rejects the token, with revocation check on", async () => {
    strapi._verifyIdToken.mockRejectedValue(new Error("expired"));
    const ctx = makeCtx();
    await createController({ strapi: strapi as never }).login(ctx as never);
    expect(strapi._verifyIdToken).toHaveBeenCalledWith("id-1", true);
    expect(ctx.status).toBe(401);
    expect(ctx.body).toMatchObject({ error: { message: "Authentication failed" } });
    expect(strapi._logActivity).toHaveBeenCalledWith(expect.objectContaining({ errorMessage: "token_invalid" }));
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
        expect.objectContaining({ action: "admin_login_denied", errorMessage: reason, firebaseUserId: "uid-1" })
      );
    }
  });

  it("returns 500 when the session cannot be minted", async () => {
    service.createSession.mockRejectedValue(new Error("Session manager error: boom"));
    const ctx = makeCtx();
    await createController({ strapi: strapi as never }).login(ctx as never);
    expect(ctx.status).toBe(500);
    expect(ctx.body).toEqual({ error: { status: 500, name: "InternalServerError", message: "Internal Server Error" } });
    expect(strapi.log.error).toHaveBeenCalled();
  });

  it("on success sets the refresh cookie and returns the core login body shape", async () => {
    const ctx = makeCtx();
    await createController({ strapi: strapi as never }).login(ctx as never);

    expect(service.resolveAdminUser).toHaveBeenCalledWith(
      expect.objectContaining({ uid: "uid-1" }),
      "ana@metacto.com"
    );
    expect(service.createSession).toHaveBeenCalledWith(7, "dev-1", true, false);
    expect(ctx.cookies.set).toHaveBeenCalledWith("strapi_admin_refresh", "refresh-1", expect.objectContaining({ httpOnly: true, path: "/admin" }));
    expect(ctx.status).toBe(200);
    expect(ctx.body).toEqual({
      data: {
        token: "access-1",
        accessToken: "access-1",
        user: expect.objectContaining({ id: 7, sanitized: true }),
      },
    });
    expect(strapi._sanitizeUser).toHaveBeenCalled();
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
});
```

- [ ] **Step 2: Run to verify failure**

Run: `$NPM test -- server/src/controllers`
Expected: FAIL, cannot find module.

- [ ] **Step 3: Implement**

Create `server/src/controllers/adminLoginController.ts`:
```ts
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
  firebase?: { auth: () => { verifyIdToken: (token: string, checkRevoked?: boolean) => Promise<AdminLoginToken> } };
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
      ipAddress: getClientIP(ctx),
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

      const body = (ctx.request.body ?? {}) as { idToken?: unknown; deviceId?: unknown; rememberMe?: unknown };
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

      const resolved = await service.resolveAdminUser(decoded, authz.email);
      if (!resolved.ok) {
        log({ ctx, success: false, token: decoded, email: authz.email, reason: resolved.reason, via: authz.via });
        return ctx.forbidden(MESSAGES.forbidden);
      }

      const deviceId = typeof body.deviceId === "string" && body.deviceId ? body.deviceId : randomUUID();
      const rememberMe = body.rememberMe === true;

      try {
        const session = await service.createSession(resolved.user.id, deviceId, rememberMe, ctx.request.secure);
        ctx.cookies.set(REFRESH_COOKIE_NAME, session.refreshToken, session.cookieOptions);

        const sanitizeUser = (s.service("admin::user") as { sanitizeUser: (user: AdminUserRecord) => unknown }).sanitizeUser;
        log({
          ctx,
          success: true,
          token: decoded,
          email: authz.email,
          via: authz.via,
          created: resolved.created,
          user: resolved.user,
        });

        ctx.status = 200;
        ctx.body = {
          data: {
            token: session.accessToken,
            accessToken: session.accessToken,
            user: sanitizeUser(resolved.user),
          },
        };
      } catch (error) {
        s.log.error(`[Firebase Auth Plugin] Admin login failed to create session: ${(error as Error).message}`);
        log({ ctx, success: false, token: decoded, email: authz.email, reason: "session_error", via: authz.via });
        ctx.status = 500;
        ctx.body = { error: { status: 500, name: "InternalServerError", message: "Internal Server Error" } };
      }
    },
  };
};
```

- [ ] **Step 4: Register the controller**

Edit `server/src/controllers/index.ts`: add `import adminLoginController from "./adminLoginController";` and `adminLoginController,` to the exported object.

- [ ] **Step 5: Run tests and type-check**

Run: `$NPM test && $NPM run test:ts:back`
Expected: all PASS. If TypeScript complains about `ctx.request.body`, keep the cast `as { ... }` shown above; do not widen `ctx` to `any`.

- [ ] **Step 6: Commit**

```bash
$NPM run format
git add server/src/controllers/adminLoginController.ts server/src/controllers/index.ts server/src/controllers/__tests__/adminLoginController.test.ts
git commit -m "feat(admin-login): controller serving the sign-in page and minting admin sessions

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: Routes, startup warnings, build

**Files:**
- Modify: `server/src/routes/content-api.ts`
- Modify: `server/src/bootstrap.ts`
- Create: `server/src/utils/admin-login-startup.ts`
- Test: `server/src/utils/__tests__/admin-login-startup.test.ts`

**Interfaces:**
- Consumes: `adminLoginController.page` and `.login` (Task 9), middleware `admin-login-rate-limit` (Task 6), `normalizeAdminLoginConfig` (Task 2).
- Produces: routes `GET /admin-login` and `POST /admin-login` under the content-api (`/api/firebase-authentication/admin-login`); `export function reportAdminLoginStartup(config: AdminLoginConfig, env: { hasSessionManager: boolean; log: { warn: (m: string) => void; error: (m: string) => void; info: (m: string) => void } }): void`.

- [ ] **Step 1: Write the failing tests for the startup report**

Create `server/src/utils/__tests__/admin-login-startup.test.ts`:
```ts
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
      { enabled: true, allowedEmails: ["a@b.com"], allowedDomains: ["metacto.com"], autoCreateRole: "strapi-editor" },
      { hasSessionManager: true, log: l }
    );
    expect(l.info).toHaveBeenCalledWith(expect.stringContaining("1 email(s), 1 domain(s)"));
    expect(l.info).toHaveBeenCalledWith(expect.stringContaining("auto-create role: strapi-editor"));
    expect(l.warn).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `$NPM test -- server/src/utils/__tests__/admin-login-startup`
Expected: FAIL, cannot find module.

- [ ] **Step 3: Implement the startup report**

Create `server/src/utils/admin-login-startup.ts`:
```ts
import { ADMIN_CLAIM, type AdminLoginConfig } from "./admin-login-authorize";

type StartupEnv = {
  hasSessionManager: boolean;
  log: { warn: (message: string) => void; error: (message: string) => void; info: (message: string) => void };
};

/**
 * One-time boot report for the admin-login feature. Pure: takes the normalized config and the facts it needs.
 */
export function reportAdminLoginStartup(config: AdminLoginConfig, env: StartupEnv): void {
  if (!config.enabled) return;

  if (!env.hasSessionManager) {
    env.log.error(
      "[Firebase Auth Plugin] adminLogin.enabled is true but this Strapi version has no session manager. Admin login requires Strapi 5.24.0 or newer; the endpoint will answer 503 until you upgrade."
    );
    return;
  }

  if (config.allowedEmails.length === 0 && config.allowedDomains.length === 0) {
    env.log.warn(
      `[Firebase Auth Plugin] adminLogin is enabled with no allowedEmails or allowedDomains. Only Firebase users carrying a truthy "${ADMIN_CLAIM}" custom claim can log in.`
    );
  }

  env.log.info(
    `[Firebase Auth Plugin] Admin login enabled: ${config.allowedEmails.length} email(s), ${config.allowedDomains.length} domain(s), auto-create role: ${config.autoCreateRole ?? "off"}`
  );
}
```

- [ ] **Step 4: Call it from bootstrap**

Edit `server/src/bootstrap.ts`. Add imports at the top:
```ts
import { normalizeAdminLoginConfig } from "./utils/admin-login-authorize";
import { reportAdminLoginStartup } from "./utils/admin-login-startup";
```
Add right after the line `await strapi.admin.services.permission.actionProvider.registerMany(actions);`:
```ts
  // Admin login via Firebase: report configuration problems once at boot
  const pluginConfig = (strapi.config.get("plugin::firebase-authentication") ?? {}) as { adminLogin?: unknown };
  reportAdminLoginStartup(normalizeAdminLoginConfig(pluginConfig.adminLogin), {
    // @ts-ignore - sessionManager exists from Strapi 5.24 and is not in older type definitions
    hasSessionManager: typeof strapi.sessionManager === "function",
    log: strapi.log,
  });
```

- [ ] **Step 5: Add the routes**

Edit `server/src/routes/content-api.ts`. Insert these two entries at the end of the `routes` array, after the `/checkPassword` route:
```ts
    {
      method: "GET",
      path: "/admin-login",
      handler: "adminLoginController.page",
      config: {
        auth: false, // Public page - sign-in happens on it
        policies: [],
      },
    },
    {
      method: "POST",
      path: "/admin-login",
      handler: "adminLoginController.login",
      config: {
        auth: false, // Public endpoint - the Firebase ID token IS the credential
        policies: [],
        middlewares: ["plugin::firebase-authentication.admin-login-rate-limit"],
      },
    },
```

- [ ] **Step 6: Run everything**

Run: `$NPM test && $NPM run test:ts:back && $NPM run build && $NPM run verify`
Expected: all tests PASS, type-check clean, `dist/` rebuilt, `strapi-plugin verify` succeeds.

- [ ] **Step 7: Commit**

```bash
$NPM run format
git add server/src/routes/content-api.ts server/src/bootstrap.ts server/src/utils/admin-login-startup.ts server/src/utils/__tests__/admin-login-startup.test.ts
git commit -m "feat(admin-login): expose admin-login routes and boot-time config report

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: Documentation and spec amendment

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-09-14-firebase-admin-login-design.md`

- [ ] **Step 1: Amend the spec's rate-limit statements**

In `docs/superpowers/specs/2026-09-14-firebase-admin-login-design.md`:
- In section 2, replace the bullet starting `Core `POST /admin/login` uses middleware `admin::rateLimit`` with:
  `- Core POST /admin/login uses an admin-namespaced rate-limit middleware. The plugin does not reference it: a route middleware from another namespace that fails to resolve would break plugin boot for every install. The plugin ships its own per-IP limiter instead (5 requests per 5 minutes).`
- In section 5 table row for `server/src/routes/content-api.ts`, replace `POST adds `middlewares: ['admin::rateLimit']`` with `POST adds middlewares: ['plugin::firebase-authentication.admin-login-rate-limit']`.
- In section 5 table, add a row: `| server/src/middlewares/admin-login-rate-limit.ts (new) | Fixed-window per-IP limiter, 5 per 5 minutes, in memory |`
- In section 7, replace the bullet starting `The POST route reuses Strapi's `admin::rateLimit`` with:
  `- The POST route is rate limited by the plugin's own middleware: 5 attempts per 5 minutes per client IP (x-forwarded-for aware). The limit is per process; multi-instance deployments get a per-instance limit.`

- [ ] **Step 2: Add the README section**

In `README.md`, add a new section after the existing `## Admin Panel` section (the one describing Plugins > Firebase Authentication):

```markdown
## Admin Panel Login with Firebase

Let Strapi administrators sign in to `/admin` with Firebase (Google or email/password) instead of a Strapi password. Works on Strapi Community Edition; no SSO license needed.

Requires Strapi 5.24.0 or newer (the plugin detects this at runtime and answers 503 on older versions).

### How it works

1. Admin opens `https://<your-api-host>/api/firebase-authentication/admin-login`.
2. Signs in with Firebase on that page.
3. The plugin verifies the Firebase ID token, checks the allowlist or the `strapiAdmin` custom claim, finds (or creates) the Strapi admin by email, and mints a normal Strapi admin session.
4. The browser lands in `/admin`, logged in. Session renewal and logout work exactly as with a password login.

### Configuration

Settings live only in `config/plugins.ts` because they decide who can become an administrator.

```ts
// config/plugins.ts
export default ({ env }) => ({
  "firebase-authentication": {
    enabled: true,
    config: {
      firebaseJsonEncryptionKey: env("FIREBASE_JSON_ENCRYPTION_KEY"),
      adminLogin: {
        enabled: env.bool("FIREBASE_ADMIN_LOGIN_ENABLED", false),
        allowedEmails: ["cto@example.com"],          // optional, exact emails
        allowedDomains: ["example.com"],             // optional, email domains
        autoCreateRole: "strapi-editor",             // optional; omit to require pre-existing admins
      },
    },
  },
});
```

| Key | Default | Meaning |
| --- | --- | --- |
| `enabled` | `false` | Turns the page and the endpoint on. Off returns 404. |
| `allowedEmails` | `[]` | Exact emails allowed to log in (case-insensitive). |
| `allowedDomains` | `[]` | Email domains allowed to log in (case-insensitive). |
| `autoCreateRole` | `null` | Role `code` (for example `strapi-editor`, `strapi-author`, `strapi-super-admin`) given to admins created on first login. `null` means the admin must already exist. |

A Firebase user is allowed when the email is verified and either it is allowlisted (email or domain) or the token carries a truthy custom claim named `strapiAdmin`:

```ts
await admin.auth().setCustomUserClaims(uid, { strapiAdmin: true });
```

### Firebase project setup

- Enable the sign-in providers you want (Google, Email/Password) in Firebase Console > Authentication > Sign-in method.
- Add your API host (for example `api.example.com`) to Firebase Console > Authentication > Settings > Authorized domains. Google sign-in fails without it.
- Set the Web API key in the plugin settings (Settings > Firebase Authentication). The sign-in page reads it from the public config endpoint.

### Security notes

- Feature is off by default. Enabling it with an empty allowlist means only the `strapiAdmin` claim grants access; the plugin logs a warning at boot.
- All denials return the same 403 message, so the endpoint cannot be used to find out which emails have admin accounts. The exact reason is written to the plugin activity log (`admin_login_denied`).
- The endpoint is rate limited to 5 attempts per 5 minutes per IP.
- Auto-created admins have no password. Password login for existing admins stays available; disabling it requires Strapi's paid SSO feature.
- The admin panel must be served from the same origin as the API (Strapi default).
```

- [ ] **Step 3: Check formatting and commit**

```bash
$NPM run format:check
git add README.md docs/superpowers/specs/2026-09-14-firebase-admin-login-design.md
git commit -m "docs: admin panel login with Firebase

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 12: Manual round-trip on a local Strapi

This task has no code. It proves the four runtime assumptions the unit tests cannot: the CSP override, the Firebase SDK loading, the localStorage handoff into `/admin`, and token renewal.

**Prerequisites:** a Firebase project with Google or Email/Password enabled, its service-account JSON, and its Web API key.

- [ ] **Step 1: Create a scratch Strapi app outside the repo**

```bash
cd /private/tmp/claude-501/-Users-felippe-Projects-Work-Firebase-strapi-plugin-firebase-auth/75dca674-2a95-487d-935f-19a26a17c4fd/scratchpad
~/.nvm/versions/node/v22.23.2/bin/npx create-strapi-app@latest admin-login-spike --quickstart --no-run --skip-cloud --typescript --install
cd admin-login-spike && ~/.nvm/versions/node/v22.23.2/bin/npm ls @strapi/strapi | tail -1
```
Expected: `@strapi/strapi@5.53.x` (or newer).

- [ ] **Step 2: Link the plugin**

```bash
cd /Users/felippe/Projects/Work/Firebase/strapi-plugin-firebase-auth && ~/.nvm/versions/node/v22.23.2/bin/npm run build
cd /private/tmp/claude-501/-Users-felippe-Projects-Work-Firebase-strapi-plugin-firebase-auth/75dca674-2a95-487d-935f-19a26a17c4fd/scratchpad/admin-login-spike
~/.nvm/versions/node/v22.23.2/bin/npm install /Users/felippe/Projects/Work/Firebase/strapi-plugin-firebase-auth
```

Create `config/plugins.ts` in the scratch app:
```ts
export default ({ env }) => ({
  "firebase-authentication": {
    enabled: true,
    config: {
      firebaseJsonEncryptionKey: env("FIREBASE_JSON_ENCRYPTION_KEY", "spike-key"),
      adminLogin: {
        enabled: true,
        allowedDomains: [env("SPIKE_ALLOWED_DOMAIN", "metacto.com")],
        autoCreateRole: "strapi-editor",
      },
    },
  },
});
```

- [ ] **Step 3: Boot and check the startup report**

```bash
~/.nvm/versions/node/v22.23.2/bin/npm run develop 2>&1 | tee /private/tmp/claude-501/-Users-felippe-Projects-Work-Firebase-strapi-plugin-firebase-auth/75dca674-2a95-487d-935f-19a26a17c4fd/scratchpad/spike.log | grep -E "Admin login|Firebase" | head
```
Expected: `Admin login enabled: 0 email(s), 1 domain(s), auto-create role: strapi-editor`.

- [ ] **Step 4: Create the first super admin and upload Firebase config**

1. Open `http://localhost:1337/admin`, register the first admin with a password.
2. Go to Settings > Firebase Authentication, upload the service-account JSON, set the Web API key, save.
3. Confirm `curl -s http://localhost:1337/api/firebase-authentication/config | jq .firebaseConfig` prints `apiKey`, `authDomain`, `projectId`.

- [ ] **Step 5: Verify the page and its CSP**

```bash
curl -si http://localhost:1337/api/firebase-authentication/admin-login | grep -i -E "^HTTP|content-security-policy|content-type"
```
Expected: `HTTP/1.1 200`, `content-type: text/html`, one `content-security-policy` header containing `'nonce-`. If the header shows Strapi's default policy instead (no nonce), apply the fallback from the spec: move the CSP into a route middleware that runs after `strapi::security`.

- [ ] **Step 6: Sign in**

1. Add `localhost` to Firebase Authorized domains (it is there by default on new projects).
2. Open `http://localhost:1337/api/firebase-authentication/admin-login` in a private window.
3. Click "Continue with Google" with an account on the allowed domain.
4. Expected: redirect to `/admin`, logged in. In DevTools > Application: `localStorage.jwtToken` set, cookie `strapi_admin_refresh` present with `Path=/admin`, `HttpOnly`.
5. Reload `/admin`. Expected: still logged in.
6. In Settings > Administration panel > Users, the auto-created admin appears with role Editor and no password set.

- [ ] **Step 7: Verify renewal and logout**

1. In DevTools > Application, change `localStorage.jwtToken` to `"expired"` and reload `/admin`. Expected: the UI calls `POST /admin/access-token` (Network tab) and stays logged in.
2. Log out from the admin UI. Expected: `strapi_admin_refresh` cookie removed, redirected to `/admin/auth/login`.

- [ ] **Step 8: Verify a denial and the activity log**

1. Open the page again in a private window and sign in with a Google account outside the allowed domain.
2. Expected: red error "You are not authorized to access the admin panel", still on the page.
3. Log in as super admin with the password, open Plugins > Firebase Authentication > the denied user's activity, or query the log:
```bash
curl -s -H "Authorization: Bearer <admin access token>" "http://localhost:1337/firebase-authentication/activity-logs?..." 
```
   Or check the database table `firebase_activity_logs` for `action = 'admin_login_denied'` and `error_message = 'not_allowlisted'`.

- [ ] **Step 9: Verify the rate limit**

```bash
for i in 1 2 3 4 5 6; do curl -s -o /dev/null -w "%{http_code} " -X POST http://localhost:1337/api/firebase-authentication/admin-login -H 'Content-Type: application/json' -d '{"idToken":"bad"}'; done; echo
```
Expected: `401 401 401 401 401 429`.

- [ ] **Step 10: Record the outcome**

Append the results (Strapi version, each step pass/fail, any fallback applied) as a comment on https://metactoengineer.atlassian.net/browse/META-63. If the CSP fallback was needed, open a follow-up task before merging.

---

## Self-review notes

- Spec coverage: config (Task 2), authorization rules (Task 3), cookie mirror with 5.53 validation (Task 4), rate limit (Task 6, with the spec amendment in Task 11), service contracts (Task 7), page and CSP (Task 8), error table and activity log (Task 9), routes and startup validation (Task 10), README and Firebase Authorized domains note (Task 11), manual round-trip steps 1 to 7 of the spec plus rate limit (Task 12). Out-of-scope items untouched.
- Deviation from spec: in-plugin rate limiter instead of `admin::rateLimit`, amended in Task 11 with the reason.
- Type consistency: `AdminLoginConfig`, `AdminLoginToken`, `AuthorizeResult` defined in Tasks 2 and 3 and consumed unchanged in Tasks 7, 9, 10. `ResolveResult`, `SessionResult`, `AdminUserRecord` defined in Task 7 and consumed in Task 9. `RefreshCookieOptions` defined in Task 4 and consumed in Task 7. `getClientIP` defined in Task 5 and consumed in Tasks 6 and 9.

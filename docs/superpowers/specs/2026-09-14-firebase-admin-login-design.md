# Firebase login for the Strapi admin panel

Date: 2026-09-14
Ticket: https://metactoengineer.atlassian.net/browse/META-63
Status: approved design, ready for implementation plan

## 1. Goal

Let Strapi administrators sign in to the admin panel (`/admin`) with Firebase
Authentication, using the plugin alone, on Strapi Community Edition. No Strapi
SSO license is required.

## 2. Background and constraints

- The Users & Permissions "Providers" list only covers end-user login. The
  plugin already handles that layer. It is not a path to admin login.
- Strapi's official admin SSO is license-gated. In `@strapi/admin` (EE source,
  `ee/server/src/services/passport.ts`) `getPassportStrategies()` returns only
  the local strategy unless `strapi.ee.features.isEnabled('sso')`.
- Since Strapi 5.24.0 (https://github.com/strapi/strapi/pull/24346) the admin
  login mints sessions through `strapi.sessionManager('admin')`. This API is
  part of Community Edition and is callable from a plugin.
- Verified against Strapi v5.34.0 and v5.53.0 (latest at time of writing):
  - `sessionManager('admin').generateRefreshToken(userId, deviceId, { type })`
    returns `{ token, sessionId, absoluteExpiresAt }`. 5.53 adds an optional
    `metadata` option; we do not pass it, to stay compatible with 5.24 to 5.52.
  - `sessionManager('admin').generateAccessToken(refreshToken)` returns
    `{ token } | { error }`.
  - Core login sets cookie `strapi_admin_refresh` and responds with
    `{ data: { token, accessToken, user } }`.
  - The admin frontend reads its token from `localStorage.jwtToken` (JSON
    string) and `localStorage.isLoggedIn = 'true'` on boot, and renews via
    `POST /admin/access-token` with `credentials: 'include'` on a 401.
  - The cookie helpers in `@strapi/admin/shared/utils/session-auth.ts` are not
    exported from the package. The plugin mirrors them.
  - `admin::user.findOneByEmail(email)` (case-insensitive since 5.53),
    `admin::user.create({ email, firstname, lastname, roles, isActive: true })`,
    `admin::user.sanitizeUser(user)`, `admin::role.findOne({ code })`.
  - Core `POST /admin/login` uses middleware `admin::rateLimit`
    (5 requests per 5 minutes, keyed by email + path + IP; falls back to
    `unknownEmail` when the body has no email).
- The admin login page in Community Edition cannot be customised, so the
  plugin serves its own sign-in page.

## 3. Flow

```
Admin opens  GET /api/firebase-authentication/admin-login        (HTML page served by the plugin)
   |  signs in with Google or email+password via the Firebase Web SDK
   v
POST /api/firebase-authentication/admin-login  { idToken, deviceId?, rememberMe? }
   1. feature enabled? Strapi exposes sessionManager?           -> else 404 / 503
   2. verify ID token with firebase-admin, require email_verified -> else 401
   3. authorize: email or domain allowlisted, OR custom claim
      `strapiAdmin` is truthy                                     -> else 403
   4. find Strapi admin by email
        found:   must be isActive and not blocked                 -> else 403
        missing: autoCreateRole set? create active admin with that role,
                 no password                                       -> else 403
   5. mint session: refresh token -> `strapi_admin_refresh` cookie
                    access token  -> { data: { token, accessToken, user } }
   6. activity log: `admin_login` on success,
                    `admin_login_denied` with reason on every denial
   v
Page writes localStorage.jwtToken (JSON string) and isLoggedIn = 'true',
then redirects to the admin path (default /admin).
```

## 4. Configuration

Plugin config only. Nothing about admin access lives in the database, because
the plugin's settings routes are guarded only by `admin::isAuthenticatedAdmin`
and a low-privilege admin could otherwise escalate.

```ts
// config/plugins.ts
'firebase-authentication': {
  config: {
    adminLogin: {
      enabled: env.bool('FIREBASE_ADMIN_LOGIN_ENABLED', false),
      allowedEmails: [],                 // exact emails, case-insensitive
      allowedDomains: ['example.com'],   // email domains, case-insensitive
      autoCreateRole: null,              // role code, e.g. 'strapi-editor'; null = off
    },
  },
},
```

| Key | Type | Default | Meaning |
| --- | --- | --- | --- |
| `adminLogin.enabled` | boolean | `false` | Off: both routes return 404 |
| `adminLogin.allowedEmails` | string[] | `[]` | Exact match, case-insensitive |
| `adminLogin.allowedDomains` | string[] | `[]` | Domain of the email, case-insensitive, no leading `@` |
| `adminLogin.autoCreateRole` | string or null | `null` | Admin role `code` assigned to auto-created admins. `null` disables auto-create |

Fixed, not configurable in this iteration:

- Custom claim name: `strapiAdmin`. Grants access when its value is truthy.
- Providers on the page: Google and email/password.
- Page and API path: `/api/firebase-authentication/admin-login`.

Startup validation (in `register`):

- `enabled: true` with empty `allowedEmails` and `allowedDomains` logs a
  warning: only the custom-claim path can grant access.
- `enabled: true` and `strapi.sessionManager` is missing logs an error naming
  the minimum Strapi version (5.24.0). Requests then return 503.
- A configured `autoCreateRole` that matches no role is detected at request
  time (denied with 403, logged as `role_not_found`), because roles live in the
  database and may not exist at boot.

## 5. Components

| File | Responsibility |
| --- | --- |
| `server/src/config/index.ts` | `AdminLoginConfig` type, defaults, added to `FirebaseAuthConfig` |
| `server/src/services/adminLoginService.ts` (new) | `getConfig()`, `isAvailable()`, `authorize(decodedToken, config)` (pure), `resolveAdminUser(decodedToken, config)`, `createSession(userId, deviceId, rememberMe)` |
| `server/src/utils/admin-session-cookie.ts` (new) | `REFRESH_COOKIE_NAME`, `buildRefreshCookieOptions(type, absoluteExpiresAt, secureRequest)`. Mirrors Strapi 5.53 `session-auth.ts` including the RFC 6265 validation of `admin.auth.cookie.domain` and `admin.auth.cookie.path`, `sameSite` default `lax`, secure rules, and the refresh-type expiry `min(idle refresh lifespan, absoluteExpiresAt)` |
| `server/src/controllers/adminLoginController.ts` (new) | `page(ctx)` for GET, `login(ctx)` for POST. Maps service outcomes to HTTP codes, sets the cookie, logs activity |
| `server/src/templates/admin-login-page.ts` (new) | Returns the HTML string. Loads the Firebase Web SDK (compat build) from `https://www.gstatic.com`, fetches `firebaseConfig` from the existing public `GET /api/firebase-authentication/config`, renders Google button, email/password form, "remember me" checkbox |
| `server/src/routes/content-api.ts` | Adds `GET /admin-login` and `POST /admin-login`, both `auth: false`. POST adds `middlewares: ['admin::rateLimit']` |
| `server/src/services/index.ts`, `server/src/controllers/index.ts` | Register the new service and controller |
| `server/src/register.ts` | Startup validation described in section 4 |
| `vitest.config.ts`, `package.json` | Vitest dev dependency and `test` script |
| `README.md` | New section: setup, Firebase "Authorized domains", limitations |

### Service contracts

```ts
type AuthorizeResult =
  | { allowed: true; via: 'email' | 'domain' | 'claim' }
  | { allowed: false; reason: 'email_missing' | 'email_unverified' | 'not_allowlisted' };

type ResolveResult =
  | { ok: true; user: AdminUser; created: boolean }
  | { ok: false; reason: 'inactive' | 'blocked' | 'not_found' | 'role_not_found' };

type SessionResult = {
  refreshToken: string;
  accessToken: string;
  cookieOptions: CookieOptions;
};
```

`authorize` is a pure function of `(decodedToken, config)` so it can be tested
without a Strapi instance. `resolveAdminUser` and `createSession` take
`strapi` through the usual service factory.

### Auto-created admins

`admin::user.create({ email, firstname, lastname, roles: [role.id], isActive: true })`
with no password. `firstname` comes from the token `name` (first word) or the
email local part; `lastname` from the remaining words or `-` when absent,
because Strapi requires both.

### Content Security Policy for the page

Strapi's `strapi::security` middleware sets a default CSP that blocks
third-party scripts and inline scripts. The `page` handler overrides the header
for its own response only:

- `script-src 'self' 'nonce-<random>' https://www.gstatic.com`
- `connect-src 'self' https://*.googleapis.com https://*.firebaseapp.com https://*.google.com`
- `frame-src https://*.firebaseapp.com https://accounts.google.com` (Google popup)
- `img-src 'self' data: https://*.googleusercontent.com`
- `style-src 'self' 'nonce-<random>'`

The nonce is generated per request with `crypto.randomBytes`. The page's inline
script and style carry that nonce. This is verified in the manual round-trip;
if the override does not take effect, the fallback is registering a route-level
middleware that sets the header after `strapi::security`.

## 6. Error behaviour

| Situation | HTTP | Client message | Activity log |
| --- | --- | --- | --- |
| Feature disabled | 404 | Not found | none |
| `strapi.sessionManager` missing (Strapi older than 5.24) | 503 | Admin login unavailable | error log with upgrade hint |
| Missing or invalid `idToken`, or `email_verified` false | 401 | Authentication failed | `admin_login_denied`, reason |
| Not allowlisted, admin inactive, blocked, missing without auto-create, or configured role not found | 403 | You are not authorized to access the admin panel | `admin_login_denied`, exact reason |
| Session manager returns `{ error }` | 500 | Internal error | error log |
| Success | 200 | `{ data: { token, accessToken, user } }` | `admin_login` |

All 403 denials share one client message so the endpoint cannot be used to
enumerate which emails have admin accounts. The exact reason is logged
server-side and in the activity log, `performedByType: 'admin'`, metadata
`{ email, reason, via, created }` as applicable, plus IP and user agent from
the request.

## 7. Security

- Config-only settings. Changing who may become admin requires a deploy.
- `email_verified` is required. The custom claim must be truthy, not just present.
- Auto-created admins have no password. The returned user goes through
  Strapi's `sanitizeUser`.
- The POST route reuses Strapi's `admin::rateLimit` middleware. Because the
  body carries no `email`, the limit is effectively per IP: 5 attempts per
  5 minutes.
- The refresh cookie is `httpOnly`, `sameSite=lax`, `path=/admin` by default,
  identical to core login, so logout and renewal work unchanged.
- The Firebase project must list the API host under Authentication >
  Settings > Authorized domains, otherwise Google sign-in is rejected by
  Firebase. Documented in the README.
- The admin panel must be served from the same origin as the API (Strapi
  default), because the handoff writes `localStorage` for the `/admin` app.

## 8. Testing

Unit tests with Vitest and a mocked `strapi`:

- `authorize`: matrix of email present/missing, verified/unverified,
  allowlisted by email, by domain, by claim truthy, by claim falsy, nothing
  configured, case-insensitivity.
- `resolveAdminUser`: found active, found inactive, found blocked, missing
  with auto-create off, missing with auto-create and role found (asserts
  `create` payload), missing with auto-create and role not found.
- `admin-session-cookie`: defaults match Strapi (`/admin`, `lax`, `httpOnly`),
  invalid domain and path fall back with a warning, secure flag rules for
  production and non-production, refresh expiry is the minimum of idle and
  absolute.
- Controller: disabled -> 404 for GET and POST; missing sessionManager -> 503;
  invalid token -> 401; each 403 reason -> identical client message; success ->
  cookie set with `strapi_admin_refresh` and body shape
  `{ data: { token, accessToken, user } }`; page response has `text/html` and
  a CSP header containing the nonce.

Type checks: existing `npm run test:ts:back`.

Manual round-trip on a local Strapi 5.53 app with the plugin linked:

1. Enable the feature with an allowlisted domain.
2. Open the page, sign in with Google.
3. Land in `/admin` authenticated.
4. Reload the page; still authenticated.
5. Wait past the access-token lifetime; the UI renews via the refresh cookie.
6. Log out from the admin UI; the refresh cookie is cleared.
7. Repeat with an email outside the allowlist; expect 403 and a denied log entry.

## 9. Out of scope

- Settings UI for these options.
- The paid SSO Passport strategy route.
- Admin panel hosted on a different origin than the API.
- Blocking password login for Firebase-managed admins.
- Apple sign-in button, phone sign-in.
- Per-provider or per-claim role mapping.
- Bumping the plugin's `peerDependencies` floor. Compatibility is detected at
  runtime instead, so existing installs on older Strapi keep working with the
  feature unavailable.

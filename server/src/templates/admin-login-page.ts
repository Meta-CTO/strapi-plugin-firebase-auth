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

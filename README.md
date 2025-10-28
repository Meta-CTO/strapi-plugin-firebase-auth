# Strapi Plugin Firebase Authentication

[![npm version](https://img.shields.io/npm/v/strapi-plugin-firebase-authentication.svg)](https://www.npmjs.com/package/strapi-plugin-firebase-authentication)
[![npm downloads](https://img.shields.io/npm/dm/strapi-plugin-firebase-authentication.svg)](https://www.npmjs.com/package/strapi-plugin-firebase-authentication)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A production-ready Strapi v5 plugin that seamlessly integrates Firebase Authentication with your Strapi Headless CMS. Authenticate users via Firebase (Google, Apple, Email/Password, Phone, Magic Link) and automatically sync them with Strapi's user system.

## Features at a Glance

- **Multiple Authentication Methods**: Google Sign-In, Apple Sign-In, Email/Password, Phone-only, Magic Link (passwordless)
- **Automatic User Sync**: Creates and updates Strapi users from Firebase authentication
- **Password Reset Flow**: Complete password reset with email verification
- **Phone-Only Support**: Configurable email handling for phone-based authentication
- **Admin Panel**: Manage Firebase users directly from Strapi admin
- **Secure Configuration**: AES-256 encrypted Firebase credentials
- **Email Service**: Three-tier fallback (Strapi Email Plugin → Firebase Extension → Console)
- **Flexible User Lookup**: Multiple strategies (Firebase UID, email, phone, Apple relay email)

## Table of Contents

1. [Quick Reference](#quick-reference)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Features & Authentication Flows](#features--authentication-flows)
5. [API Reference](#api-reference)
6. [Admin Panel](#admin-panel)
7. [Client Integration](#client-integration)
8. [Email Templates](#email-templates)
9. [Architecture & Database](#architecture--database)
10. [Security](#security)
11. [Troubleshooting](#troubleshooting)
12. [Best Practices](#best-practices)
13. [Support](#support)

## Quick Reference

### Essential Endpoints

**Authentication:**

- `POST /api/firebase-authentication` - Exchange Firebase token for Strapi JWT
- `POST /api/firebase-authentication/emailLogin` - Direct email/password login
- `POST /api/firebase-authentication/forgotPassword` - Request password reset
- `POST /api/firebase-authentication/resetPassword` - Reset with JWT token
- `POST /api/firebase-authentication/requestMagicLink` - Passwordless login
- `GET /api/firebase-authentication/config` - Get public configuration

### Minimal Configuration

```javascript
// config/plugins.js
module.exports = () => ({
  "firebase-authentication": {
    enabled: true,
    config: {
      FIREBASE_JSON_ENCRYPTION_KEY: process.env.FIREBASE_JSON_ENCRYPTION_KEY,
    },
  },
});
```

```bash
# .env
FIREBASE_JSON_ENCRYPTION_KEY=your-secure-32-character-key-here
```

### Required Setup Steps

1. **Install:** `yarn add strapi-plugin-firebase-authentication`
2. **Configure:** Add plugin config to `config/plugins.js`
3. **Build:** `yarn build && yarn develop`
4. **Upload:** Settings → Firebase Authentication → Upload service account JSON
5. **Permissions:** Settings → Users & Permissions → Public → `firebase-authentication.authenticate` ✓

### Admin Access

- **Settings:** Settings → Firebase Authentication
- **User Management:** Plugins → Firebase Authentication

---

## Installation

### Prerequisites

Before installing, ensure you have:

- Strapi v5 project (this plugin is for v5 only)
- Firebase project with Authentication enabled ([Create one](https://console.firebase.google.com/))
- Node.js 18+ and npm/yarn installed

### Step 1: Install Plugin

```bash
yarn add strapi-plugin-firebase-authentication
# or
npm install strapi-plugin-firebase-authentication
```

**Verify:** Check that the plugin appears in your `package.json` dependencies.

---

### Step 2: Create Encryption Key

Generate a secure 32+ character encryption key for storing Firebase credentials:

```bash
# Generate a random key (save this!)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Common Mistake:** Using a weak or short key. The key MUST be at least 32 characters.

---

### Step 3: Configure Plugin

Create or edit `config/plugins.js`:

```javascript
module.exports = () => ({
  "firebase-authentication": {
    enabled: true,
    config: {
      FIREBASE_JSON_ENCRYPTION_KEY: process.env.FIREBASE_JSON_ENCRYPTION_KEY,
    },
  },
});
```

Add to `.env` file:

```bash
FIREBASE_JSON_ENCRYPTION_KEY=your-generated-key-from-step-2
```

**Verify:** Run `echo $FIREBASE_JSON_ENCRYPTION_KEY` to confirm it's set.

---

### Step 4: Build and Start

```bash
yarn build
yarn develop
```

**What happens:**

- Plugin compiles (admin + server)
- Strapi restarts with plugin enabled
- "Firebase Authentication" appears in Plugins sidebar

**Verify:** Check console output for:

```
✔ Building admin panel (XX.Xs)
Firebase Authentication plugin initialized
```

**If build fails:** Run `yarn build --clean` to clear cache.

---

### Step 5: Download Firebase Service Account

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to: **Project Settings** (⚙️ icon) → **Service Accounts** tab
4. Click **"Generate New Private Key"**
5. Download and save the JSON file securely (you'll upload this next)

**Important:** This JSON contains sensitive credentials. Never commit it to Git.

---

### Step 6: Upload to Strapi

1. Navigate to: **Settings → Firebase Authentication** (left sidebar)
2. Click **"Upload Configuration"** button
3. Select the downloaded service account JSON file
4. Wait for "Configuration uploaded successfully" message
5. **Restart Strapi:** `yarn develop` (important!)

**Verify:** You should see in console:

```
Firebase Admin SDK initialized successfully
```

**If initialization fails:** Check [Troubleshooting](#troubleshooting) section.

---

### Step 7: Configure Permissions

Navigate to: **Settings → Users & Permissions → Roles → Public**

Enable these permissions:

- `firebase-authentication` → `authenticate` ✓

**Why:** This allows unauthenticated users to exchange Firebase tokens for Strapi JWTs.

**Verify:** The permission checkbox should be checked and saved.

---

### Step 8: Test Your Setup

Create a simple test to verify everything works:

**Option 1: Test with Firebase Token**

1. Get a Firebase ID token from your client app (or Firebase Console)
2. Send POST request to: `http://localhost:1337/api/firebase-authentication`
3. Body: `{ "idToken": "your-firebase-token-here" }`
4. Expected: `200 OK` with `{ user, jwt }` response

**Option 2: Test with Email/Password** (if configured)

1. Create a user in Firebase Console
2. Send POST to: `http://localhost:1337/api/firebase-authentication/emailLogin`
3. Body: `{ "email": "test@example.com", "password": "password123" }`
4. Expected: `200 OK` with `{ user, jwt }` response

**If tests fail:** Check [Troubleshooting](#troubleshooting) for common issues.

---

### Common Setup Mistakes

❌ **Encryption key too short** → Must be 32+ characters
❌ **Forgot to restart after uploading config** → Always restart Strapi
❌ **Wrong Firebase project** → Ensure service account matches your client app
❌ **Forgot to enable permissions** → Public role needs `authenticate` permission
❌ **Committed service account JSON to Git** → Use `.gitignore`

---

### Next Steps

After successful installation:

1. **Configure additional settings** (optional):
   - Password requirements: **Settings → Firebase Authentication**
   - Magic link settings (passwordless auth)
   - Email templates for password reset

2. **Integrate with your client app** (see [Client Integration](#client-integration))

3. **Set up email service** for password reset (see [Email Templates](#email-templates))

4. **Review security best practices** (see [Best Practices](#best-practices))

## Configuration

The plugin is configured in two places: `config/plugins.js` and the Strapi admin panel.

**Minimal Configuration** (`config/plugins.js`):

```javascript
module.exports = () => ({
  "firebase-authentication": {
    enabled: true,
    config: {
      FIREBASE_JSON_ENCRYPTION_KEY: process.env.FIREBASE_JSON_ENCRYPTION_KEY,
    },
  },
});
```

**Admin Panel Settings** (Settings → Firebase Authentication):

- Firebase Web API Key (for email/password login)
- Password requirements (regex + message)
- Password reset URL & email subject
- Magic link settings (enable, URL, subject, expiry)
- Phone-only user handling (`emailRequired: false` for phone-only apps)

## API Reference

### Public Endpoints

| Method | Endpoint                                        | Purpose                                |
| ------ | ----------------------------------------------- | -------------------------------------- |
| POST   | `/api/firebase-authentication`                  | Exchange Firebase token for Strapi JWT |
| POST   | `/api/firebase-authentication/emailLogin`       | Email/password login (no SDK required) |
| POST   | `/api/firebase-authentication/forgotPassword`   | Request password reset email           |
| POST   | `/api/firebase-authentication/resetPassword`    | Reset password with JWT token          |
| POST   | `/api/firebase-authentication/requestMagicLink` | Request passwordless login email       |
| GET    | `/api/firebase-authentication/config`           | Get public configuration               |

### Admin Endpoints

**User Management:**
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/firebase-authentication/content-internal-api/users` | List/search users |
| POST | `/api/firebase-authentication/content-internal-api/users` | Create user |
| GET | `/api/firebase-authentication/content-internal-api/users/:id` | Get user |
| PUT | `/api/firebase-authentication/content-internal-api/users/:id` | Update user |
| DELETE | `/api/firebase-authentication/content-internal-api/users/:id` | Delete user |
| PUT | `/api/firebase-authentication/content-internal-api/users/resetPassword/:id` | Reset password |

**Settings Management:**
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET/POST/DELETE | `/api/firebase-authentication/settings/firebase-config` | Manage Firebase config |
| POST | `/api/firebase-authentication/settings/password-config` | Update password/magic link settings |

---

## Usage

**Basic Flow:**

1. User authenticates with Firebase Client SDK
2. Client gets Firebase ID token
3. Client sends token to Strapi: `POST /api/firebase-authentication`
4. Plugin returns Strapi JWT for API access

**Example (JavaScript):**

```javascript
// After Firebase authentication
const idToken = await firebaseUser.getIdToken();

// Exchange with Strapi
const response = await fetch("https://your-api.com/api/firebase-authentication", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ idToken }),
});

const { user, jwt } = await response.json();
localStorage.setItem("jwt", jwt); // Use this JWT for Strapi API calls
```

**Resources:**

- [Firebase Web SDK](https://firebase.google.com/docs/auth/web/start)
- [Firebase iOS SDK](https://firebase.google.com/docs/auth/ios/start)
- [Firebase Android SDK](https://firebase.google.com/docs/auth/android/start)

---

## Architecture

The plugin validates Firebase ID tokens and syncs users between Firebase and Strapi. Users authenticate via Firebase on the client, then exchange their Firebase token for a Strapi JWT to access your API.

**Security:**

- Firebase service account JSON encrypted with AES-256
- All tokens validated server-side via Firebase Admin SDK
- Passwords managed by Firebase (not Strapi)
- User responses automatically sanitized

## Troubleshooting

### 🔴 "Firebase is not initialized"

**Solution:**

1. Verify `FIREBASE_JSON_ENCRYPTION_KEY` in `config/plugins.js` (min 32 characters)
2. Upload Firebase service account JSON: **Settings → Firebase Authentication**
3. Restart Strapi: `yarn develop`
4. Check startup logs for initialization errors

---

### 🔴 "Token validation failed"

**Solution:**

1. Ensure token hasn't expired (1 hour TTL) - client should obtain fresh token
2. Verify client and server use the same Firebase project
3. Confirm service account JSON matches your Firebase project ID
4. Check Firebase Console for service status

---

### 🔴 Email Not Sending

**Solution:**

Install and configure Strapi Email Plugin:

```bash
yarn add @strapi/provider-email-sendgrid
```

```javascript
// config/plugins.js
email: {
  config: {
    provider: 'sendgrid',
    providerOptions: { apiKey: env('SENDGRID_API_KEY') },
    settings: {
      defaultFrom: 'noreply@yourapp.com'
    }
  }
}
```

Alternative: Install [Firebase Email Extension](https://extensions.dev/extensions/firebase/firestore-send-email)

---

**Need more help?** Check [Firebase Console](https://console.firebase.google.com/) logs or [GitHub Issues](https://github.com/meta-cto/strapi-plugin-firebase-auth/issues)

## Best Practices

- Use Firebase SDK for authentication (not `emailLogin` for production)
- Store JWTs in httpOnly cookies (production) or secure storage (mobile)
- Configure Strapi Email Plugin (SendGrid, Mailgun, SES) for production
- Implement rate limiting on public endpoints
- Enforce HTTPS for password reset URLs
- Monitor Firebase quotas regularly
- Keep dependencies updated

---

## Support

### Questions and Issues

If you encounter problems or have questions:

1. **Check Troubleshooting Section:** Review common errors above
2. **Firebase Documentation:** [firebase.google.com/docs/auth](https://firebase.google.com/docs/auth)
3. **Strapi Documentation:** [docs.strapi.io](https://docs.strapi.io)
4. **GitHub Issues:** [github.com/meta-cto/strapi-plugin-firebase-auth/issues](https://github.com/meta-cto/strapi-plugin-firebase-auth/issues)
   - Search existing issues first
   - Provide detailed information when creating new issues

### Creating a Bug Report

When reporting issues, please include:

1. **Plugin version:** Check `package.json`
2. **Strapi version:** Run `yarn strapi version`
3. **Node version:** Run `node --version`
4. **Error message:** Full error text and stack trace
5. **Steps to reproduce:** Detailed steps to trigger the issue
6. **Configuration:** Relevant plugin configuration (redact sensitive data)
7. **Expected behavior:** What should happen
8. **Actual behavior:** What actually happens

### Feature Requests

To request new features:

1. Search existing feature requests
2. Create detailed proposal with use case
3. Explain why feature would be beneficial
4. Suggest implementation approach (if applicable)

### Community

- **GitHub Discussions:** Ask questions and share experiences
- **Discord:** Join Strapi community Discord server
- **Stack Overflow:** Tag questions with `strapi` and `firebase`

---

## License

This plugin is licensed under the MIT License. See `LICENSE.md` for full details.

---

## Changelog

See `CHANGELOG.md` for version history and release notes.

---

## Credits

Developed and maintained by **Meta CTO** team.

**Contributors:**

- Firebase Admin SDK: Google
- Strapi Framework: Strapi Solutions SAS
- AES Encryption: crypto-js library

---

## Additional Resources

**Firebase Documentation:**

- [Firebase Authentication](https://firebase.google.com/docs/auth)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- Platform Guides: [Web](https://firebase.google.com/docs/web/setup) | [iOS](https://firebase.google.com/docs/ios/setup) | [Android](https://firebase.google.com/docs/android/setup)

**Strapi Documentation:**

- [Strapi v5](https://docs.strapi.io/dev-docs/intro)
- [Email Providers](https://market.strapi.io/providers) (SendGrid, Mailgun, Amazon SES)

**Firebase Extensions:**

- [Trigger Email Extension](https://extensions.dev/extensions/firebase/firestore-send-email)

---

**Thank you for using Strapi Plugin Firebase Authentication!** 🎉

If you find this plugin helpful, please consider:

- Starring the GitHub repository
- Sharing with your community
- Contributing improvements
- Reporting issues to help us improve

Happy coding! 🚀

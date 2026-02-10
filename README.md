# Strapi Plugin Firebase Authentication

[![npm version](https://img.shields.io/npm/v/strapi-plugin-firebase-authentication.svg)](https://www.npmjs.com/package/strapi-plugin-firebase-authentication)
[![npm downloads](https://img.shields.io/npm/dm/strapi-plugin-firebase-authentication.svg)](https://www.npmjs.com/package/strapi-plugin-firebase-authentication)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Use Firebase Authentication with Strapi v5** - without building custom auth logic.

Firebase handles user authentication (Google, Apple, Phone, Email, Magic Link). This plugin bridges Firebase to Strapi by verifying tokens, automatically creating/syncing users, and returning Strapi JWTs for API access. Your users authenticate once with Firebase and get full access to your Strapi content based on roles and permissions.

## How It Works

```mermaid
sequenceDiagram
    participant App as Your App
    participant Firebase as Firebase Auth
    participant Strapi as Strapi + Plugin

    rect rgb(240, 248, 255)
        Note over App,Firebase: Authentication
        App->>Firebase: 1. Sign in (Google, Apple, Phone, Email...)
        Firebase-->>App: 2. Returns Firebase ID Token
    end

    rect rgb(240, 255, 240)
        Note over App,Strapi: Token Exchange
        App->>Strapi: 3. POST /api/firebase-authentication { idToken }
        Strapi->>Firebase: 4. Verify token
        Firebase-->>Strapi: 5. Token valid
        Note over Strapi: 6. Find or create Strapi user
        Strapi-->>App: 7. Returns { user, jwt }
    end

    rect rgb(255, 250, 240)
        Note over App,Strapi: API Access
        App->>Strapi: 8. GET /api/content (Bearer jwt)
        Strapi-->>App: 9. Protected data
    end
```

**Summary:**

- **Steps 1-2:** User authenticates with Firebase (you handle this with Firebase SDK)
- **Steps 3-7:** You send the Firebase token to this plugin, it verifies with Firebase, finds or creates a Strapi user, and returns a Strapi JWT
- **Steps 8-9:** You use the Strapi JWT for all API calls to access protected content

## Features

- 🔐 **Multi-Provider Auth** - Support for Google, Apple, Email/Password, Phone, and Magic Link. All providers are verified server-side via Firebase Admin SDK and mapped to a single Strapi user using Firebase UID as the primary link. User signs in with Google on mobile, later with Apple on web - same Strapi user, same roles and permissions.

- 🔄 **Auto User Sync** - On first authentication, the plugin automatically creates a Strapi user with the default `authenticated` role. Existing users are matched by Firebase UID first, then by email, then by phone number. Profile data (name, email, phone) is synced from the Firebase token. No manual user creation needed - scales to thousands of users.

- 📱 **Phone-Only Auth** - For apps where email isn't required (common in emerging markets), the plugin generates unique placeholder emails using configurable patterns with tokens: `{randomString}`, `{phoneNumber}`, `{timestamp}`. Example: `{randomString}@phone-user.local` becomes `a1b2c3d4@phone-user.local`. Phone users get full access to Strapi's permission system.

- 🔑 **Password Reset** - Two flows available: `POST /forgotPassword` sends a branded reset email via your Strapi email provider (SendGrid, Mailgun, etc.), and `POST /resetPassword` allows authenticated password changes. Includes customizable email templates, configurable reset URLs, regex password validation, and optional Firebase custom tokens for auto-login after reset.

- ✨ **Magic Link** - Passwordless authentication via `POST /requestMagicLink`. Generates a secure one-time JWT token with configurable expiry (1-72 hours), sends via your Strapi email provider, and returns a Strapi JWT on verification. Tokens are invalidated after use. Perfect for B2B apps where users prefer "email me a login link" over passwords.

- 🛡️ **Encrypted Config** - Firebase service account JSON (contains private keys) is encrypted with AES-256 using your `FIREBASE_JSON_ENCRYPTION_KEY` before storing in the database. Decrypted only in memory at runtime - never exposed in API responses, logs, or database backups. Meets enterprise security requirements.

- 📊 **Activity Logging** - Tracks all authentication events with full context: user ID, Firebase UID, action type (login, token exchange, password reset, account deletion), IP address, and timestamp. Automatic cleanup via `FIREBASE_ACTIVITY_LOG_RETENTION_DAYS`. Essential for security audits, debugging auth issues, and compliance requirements.

- 🎛️ **Admin Panel** - Full Firebase user management UI integrated into Strapi admin at Plugins > Firebase Authentication. Search users by email/phone/UID, view linked Strapi accounts, edit user details, trigger password reset emails, send verification emails, and delete users from Firebase, Strapi, or both. No need to switch to Firebase Console.

## Quick Start

### 1. Install

```bash
yarn add strapi-plugin-firebase-authentication
# or
npm install strapi-plugin-firebase-authentication
```

### 2. Configure

Create or update `config/plugins.js`:

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

Add to `.env`:

```bash
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
FIREBASE_JSON_ENCRYPTION_KEY=your-32-character-minimum-key-here
```

### 3. Build & Start

```bash
yarn build && yarn develop
```

### 4. Upload Firebase Config

1. Go to [Firebase Console](https://console.firebase.google.com/) → Project Settings → Service Accounts
2. Click **Generate New Private Key** (downloads JSON)
3. In Strapi: **Settings → Firebase Authentication → Upload Configuration**
4. Restart Strapi after uploading

### 5. Enable Permissions

**Settings → Users & Permissions → Roles → Public**

Enable: `firebase-authentication` → `authenticate` ✓

## API Reference

### Authentication Endpoints

| Method | Endpoint                                        | Purpose                                |
| ------ | ----------------------------------------------- | -------------------------------------- |
| POST   | `/api/firebase-authentication`                  | Exchange Firebase token for Strapi JWT |
| POST   | `/api/firebase-authentication/emailLogin`       | Direct email/password login            |
| POST   | `/api/firebase-authentication/forgotPassword`   | Request password reset email           |
| POST   | `/api/firebase-authentication/requestMagicLink` | Request passwordless login link        |
| GET    | `/api/firebase-authentication/config`           | Get public configuration               |

### Token Exchange (Main Endpoint)

```bash
POST /api/firebase-authentication
Content-Type: application/json

{
  "idToken": "firebase-id-token-here",
  "profileMetaData": {           // Optional
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

**Response:**

```json
{
  "user": {
    "id": 1,
    "documentId": "abc123",
    "email": "user@example.com",
    "username": "user"
  },
  "jwt": "strapi-jwt-token"
}
```

## Client Integration

```javascript
import { getAuth } from "firebase/auth";

// After Firebase sign-in
const auth = getAuth();
const idToken = await auth.currentUser.getIdToken();

// Exchange for Strapi JWT
const response = await fetch("https://your-api.com/api/firebase-authentication", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ idToken }),
});

const { user, jwt } = await response.json();

// Use JWT for Strapi API calls
const content = await fetch("https://your-api.com/api/articles", {
  headers: { Authorization: `Bearer ${jwt}` },
});
```

## Configuration

### Plugin Config (`config/plugins.js`)

```javascript
module.exports = () => ({
  "firebase-authentication": {
    enabled: true,
    config: {
      // Required: Key used to encrypt Firebase credentials (min 32 characters)
      FIREBASE_JSON_ENCRYPTION_KEY: process.env.FIREBASE_JSON_ENCRYPTION_KEY,

      // Optional: Require email for all users (default: false)
      // When false, phone-only users get auto-generated emails
      emailRequired: false,

      // Optional: Email pattern for phone-only users
      // Tokens: {randomString}, {phoneNumber}, {timestamp}
      emailPattern: "{randomString}@phone-user.firebase.local",

      // Optional: Days to keep activity logs (default: null = forever)
      activityLogRetentionDays: 90,
    },
  },
});
```

### Environment Variables

| Variable                               | Required | Description                                                                                                                                                   |
| -------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FIREBASE_JSON_ENCRYPTION_KEY`         | Yes      | AES encryption key for Firebase credentials. Minimum 32 characters. Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `FIREBASE_EMAIL_REQUIRED`              | No       | Set to `true` to require email for all users. Default: `false`                                                                                                |
| `FIREBASE_ACTIVITY_LOG_RETENTION_DAYS` | No       | Auto-delete logs older than N days. Default: `null` (keep forever)                                                                                            |

### Admin Panel Settings

Configure in **Settings → Firebase Authentication**:

**General**
| Setting | Default | Description |
|---------|---------|-------------|
| Firebase Web API Key | - | Required for `emailLogin` endpoint. Get from Firebase Console → Project Settings → General |

**Password Settings**
| Setting | Default | Description |
|---------|---------|-------------|
| Password Requirements Regex | `^.{6,}$` | Regex pattern for password validation (default: 6+ chars) |
| Password Requirements Message | "Password must be at least 6 characters long" | Error message shown when password doesn't match regex |
| Password Reset URL | `http://localhost:3000/reset-password` | URL where users land after resetting password |
| Password Reset Email Subject | "Reset Your Password" | Subject line for password reset emails |
| Include Credentials in Reset Link | `false` | Include Firebase custom token for auto-login after reset |

**Magic Link (Passwordless)**
| Setting | Default | Description |
|---------|---------|-------------|
| Enable Magic Link | `false` | Toggle passwordless email authentication |
| Magic Link URL | `http://localhost:1338/verify-magic-link.html` | Landing page for magic link clicks |
| Magic Link Email Subject | "Sign in to Your Application" | Subject line for magic link emails |
| Magic Link Expiry Hours | `1` | Token validity (1-72 hours) |

**Email Verification**
| Setting | Default | Description |
|---------|---------|-------------|
| Email Verification URL | `http://localhost:3000/verify-email` | URL for email verification redirect |
| Email Verification Subject | "Verify Your Email" | Subject line for verification emails |
| Include Credentials in Verification Link | `false` | Include Firebase custom token for auto-login after verification |

### Firebase Service Account

The service account JSON (uploaded via admin panel) should contain:

```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...",
  "client_email": "firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token"
}
```

Get this from: [Firebase Console](https://console.firebase.google.com/) → Project Settings → Service Accounts → Generate New Private Key

## Admin Panel

Access at **Plugins → Firebase Authentication**:

- View and search Firebase users
- Edit user details
- Delete users (from Firebase, Strapi, or both)
- Send password reset emails
- View activity logs

## Troubleshooting

### "Firebase is not initialized"

1. Check `FIREBASE_JSON_ENCRYPTION_KEY` is set (minimum 32 characters)
2. Upload Firebase service account JSON via admin panel
3. Restart Strapi after uploading config
4. Check console for initialization errors

### "Token validation failed"

1. Token expired (1 hour TTL) - get a fresh token from client
2. Wrong Firebase project - ensure service account matches your app
3. Check Firebase Console for service status

### "Emails not sending"

Install and configure Strapi email provider:

```bash
yarn add @strapi/provider-email-sendgrid
```

```javascript
// config/plugins.js
module.exports = () => ({
  email: {
    config: {
      provider: "sendgrid",
      providerOptions: { apiKey: process.env.SENDGRID_API_KEY },
      settings: { defaultFrom: "noreply@yourapp.com" },
    },
  },
  // ... firebase-authentication config
});
```

## Links

- [GitHub Issues](https://github.com/meta-cto/strapi-plugin-firebase-auth/issues)
- [Firebase Auth Docs](https://firebase.google.com/docs/auth)
- [Strapi v5 Docs](https://docs.strapi.io)

## License

MIT License - see [LICENSE.md](LICENSE.md)

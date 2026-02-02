# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Strapi v5 plugin that integrates Firebase Authentication with Strapi CMS. The plugin allows Firebase-authenticated users to access Strapi resources and manages user synchronization between Firebase and Strapi. The plugin is published as `strapi-plugin-firebase-authentication` on npm.

## Development Commands

```bash
# Install dependencies after cloning
npm run afterClone  # Removes dist/, node_modules/, package-lock.json and reinstalls

# Build the plugin (REQUIRED after any changes)
npm run build       # Builds both admin and server components

# Development mode with auto-rebuild
npm run watch       # Watch and rebuild on changes
npm run watch:link  # Watch, rebuild, and link for local Strapi development

# Code formatting (Prettier)
npm run format       # Auto-format all code
npm run format:check # Check formatting without changes

# Type checking (important before commits)
npm run test:ts:back  # Check server TypeScript (server/tsconfig.json)
npm run test:ts:front # Check admin TypeScript (admin/tsconfig.json)

# Plugin verification (runs before release)
npm run verify      # Verifies plugin structure and configuration

# Release process (automated)
npm run release     # Formats, builds, verifies, generates changelog, publishes to npm, and pushes tags
```

## Architecture

### Plugin Structure

```
strapi-plugin-firebase-auth/
├── admin/                  # React-based admin panel
│   ├── src/
│   │   ├── index.ts       # Admin plugin registration
│   │   ├── pages/         # UI pages
│   │   ├── components/    # Reusable components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── services/      # API service layer
│   │   └── utils/         # Helper functions
├── server/                 # Backend API
│   ├── src/
│   │   ├── index.ts       # Server plugin entry
│   │   ├── bootstrap.ts   # Plugin initialization
│   │   ├── controllers/   # Request handlers
│   │   ├── services/      # Business logic
│   │   ├── routes/        # API endpoints
│   │   ├── content-types/ # Database schemas
│   │   └── utils/         # Server utilities
└── dist/                   # Built output (gitignored)
```

### Core Components

#### Server Services (`server/src/services/`)

- **firebaseService.ts**: Core Firebase authentication logic
  - `validateFirebaseToken()`: Main endpoint handler for token validation
  - `checkIfUserExists()`: Smart user lookup by firebaseUserID, email, appleEmail, or phone
  - `createStrapiUser()`: Creates Strapi user from Firebase token
  - `updateUserIDToken()`: Syncs Firebase token with Strapi user
  - `decodeIDToken()`: Verifies Firebase ID tokens

- **settingsService.ts**: Firebase configuration management
  - `init()`: Initializes Firebase Admin SDK on bootstrap
  - `encryptJson()`/`decryptJson()`: AES encryption for Firebase service account
  - `setFirebaseConfigJson()`: Stores encrypted Firebase config
  - `restart()`: Reloads Strapi after config changes

- **userService.ts**: User CRUD operations
  - Manages both Firebase and Strapi users
  - Supports bulk operations
  - Password reset for both systems

#### Admin Components (`admin/src/`)

- **pages/HomePage.tsx**: Main Firebase users list
- **pages/Settings/**: Firebase configuration upload interface
- **pages/ListView/**: User management table with search, pagination
- **components/UserManagement/**: Delete account & reset password modals
- **components/DynamicTable/**: Reusable Firebase user table

### Authentication Flow

1. **Client obtains Firebase ID token** (via Firebase SDK)
2. **Client sends POST to `/api/firebase-authentication`** with:
   ```json
   {
     "idToken": "firebase_id_token_here",
     "profileMetaData": {
       "firstName": "John",
       "lastName": "Doe",
       "email": "john@example.com",
       "phoneNumber": "+1234567890"
     }
   }
   ```
3. **Plugin validates token** with Firebase Admin SDK
4. **User lookup logic** (in order):
   - By `firebaseUserID` (if field exists)
   - By `email` or `appleEmail` (for Apple Sign-In)
   - By `phoneNumber`
5. **User creation** if not found:
   - Creates with default role from settings
   - Sets `confirmed: true`
   - Generates username from email or phone
   - Creates fake email for phone-only users
6. **Returns JWT** for Strapi API access:
   ```json
   {
     "user": {
       /* sanitized user object */
     },
     "jwt": "strapi_jwt_token"
   }
   ```

### Data Model

#### Firebase Configuration Storage

- Stored in `firebase_authentication_configurations` single-type
- Service account JSON encrypted with AES using `FIREBASE_JSON_ENCRYPTION_KEY`
- Stored as `firebase_config_json` JSON field

#### User Field Extensions

Required on Strapi User model:

- `firebaseUserID` (string): Links Firebase UID
- `appleEmail` (string): Stores Apple relay emails
- `idToken` (text): Last Firebase token

Optional profile fields (auto-populated):

- `firstName`, `lastName`, `phoneNumber`, `email`

## API Endpoints

### Public API (`/api/firebase-authentication`)

```
POST /api/firebase-authentication
  Body: { idToken, profileMetaData? }
  Returns: { user, jwt }
```

### Admin API (`/api/firebase-authentication/content-internal-api/*`)

```
# User Management
GET    /users                     # List with pagination
POST   /users                     # Create user
GET    /users/:id                 # Get single user
PUT    /users/:id                 # Update user
DELETE /users/:id?destination=    # Delete (strapi|firebase|both)
DELETE /users?ids=                # Bulk delete
PUT    /users/resetPassword/:id   # Reset password

# Settings Management
GET    /settings/firebase-config  # Get config (decrypted)
POST   /settings/firebase-config  # Set config (encrypts)
DELETE /settings/firebase-config  # Remove config
POST   /settings/restart          # Restart Strapi
```

## Configuration

### Required Plugin Configuration (`config/plugins.js`)

```javascript
module.exports = () => ({
  "firebase-auth": {
    enabled: true,
    config: {
      FIREBASE_JSON_ENCRYPTION_KEY: process.env.FIREBASE_JSON_ENCRYPTION_KEY || "your-secure-key",
    },
  },
});
```

### Environment Variables

```bash
FIREBASE_JSON_ENCRYPTION_KEY=your-32-char-secure-key  # Required for encryption
```

### Firebase Service Account Setup

1. Go to Firebase Console → Project Settings → Service Accounts
2. Generate new private key (downloads JSON)
3. Upload via Strapi admin → Settings → Firebase Authentication
4. The JSON is encrypted and stored in database

## Code Style & Conventions

### Prettier Configuration (`.prettierrc`)

```json
{
  "endOfLine": "lf",
  "tabWidth": 2,
  "printWidth": 110,
  "singleQuote": false,
  "trailingComma": "es5",
  "semi": true,
  "useTabs": false
}
```

### TypeScript Configuration

- Server: `server/tsconfig.json` extends `@strapi/typescript-utils/tsconfigs/server`
- Admin: `admin/tsconfig.json` extends `@strapi/typescript-utils/tsconfigs/admin`

### Important Patterns

#### Error Handling

```typescript
// Use promiseHandler utility for consistent error handling
const { data, error } = await promiseHandler(asyncOperation());
if (error) {
  throw new errors.ValidationError(error.message);
}
```

#### User Sanitization

Always sanitize user data before returning:

```typescript
import sanitizeUser from "./sanitize-user";
user = sanitizeUser(user);
```

#### Firebase Admin Access

```typescript
// Firebase Admin SDK available globally after init
strapi.firebase.auth().verifyIdToken(token);
strapi.firebase.auth().deleteUser(uid);
```

## Security Considerations

1. **Encryption Key**: `FIREBASE_JSON_ENCRYPTION_KEY` must be strong and kept secret
2. **Service Account**: Firebase service account JSON contains sensitive credentials
3. **Token Validation**: Always verify Firebase tokens server-side
4. **User Sanitization**: Never return sensitive fields (password, etc.)
5. **Permissions**: Configure proper Strapi roles and permissions

## Common Development Tasks

### Adding New User Fields

1. Add field to Strapi User content-type via admin
2. Update `firebaseService.createStrapiUser()` to populate field
3. Update `processMeData()` if field needs special handling

### Debugging Authentication Issues

1. Check console logs for "validateFirebaseToken 🤣" markers
2. Verify Firebase config is uploaded and encrypted
3. Check `strapi.firebase` is initialized in bootstrap
4. Ensure user has `firebaseUserID` field in schema

### Testing Token Validation

```bash
# Get Firebase ID token from client
curl -X POST http://localhost:1337/api/firebase-authentication \
  -H "Content-Type: application/json" \
  -d '{"idToken": "YOUR_FIREBASE_TOKEN"}'
```

### Handling Apple Sign-In

- Apple uses private relay emails (`@privaterelay.appleid.com`)
- Plugin auto-detects and stores in `appleEmail` field
- Ensures users can login with same Apple ID

### Phone-Only Authentication

- Creates fake email (`randomstring@maz.com`) when no email provided
- Uses phone number as username
- Validates uniqueness of generated emails

## Troubleshooting

### Firebase not initialized

- Check encryption key in `config/plugins.js`
- Verify service account JSON uploaded
- Check bootstrap logs for initialization errors

### Token validation fails

- Ensure Firebase project ID matches service account
- Check token hasn't expired (1 hour TTL)
- Verify client and server use same Firebase project

### User not found/created

- Ensure `firebaseUserID` field exists on User model
- Check role settings in Users & Permissions plugin
- Verify `confirmed` field allows true value

## Release Process

The plugin uses `changelogen` for automated releases:

1. Make changes and commit
2. Run `npm run release`
3. This will:
   - Format code
   - Build plugin
   - Run verification
   - Generate changelog
   - Bump version
   - Publish to npm
   - Push git tags

## Important Files Reference

| File                                                              | Purpose                    |
| ----------------------------------------------------------------- | -------------------------- |
| `server/src/services/firebaseService.ts`                          | Core authentication logic  |
| `server/src/services/settingsService.ts`                          | Firebase config management |
| `server/src/bootstrap.ts`                                         | Plugin initialization      |
| `server/src/controllers/firebaseController.ts`                    | Main API endpoint          |
| `server/src/routes/content-api.ts`                                | Public routes definition   |
| `admin/src/pages/Settings/index.tsx`                              | Config upload UI           |
| `admin/src/pages/ListView/index.tsx`                              | User management UI         |
| `server/src/content-types/firebase-authentication-configuration/` | Config schema              |

## Dependencies

### Core Dependencies

- `firebase-admin`: ^13.1.0 - Firebase Admin SDK
- `crypto-js`: ^4.2.0 - AES encryption for config
- `@strapi/design-system`: ^2.0.0-rc.16 - UI components
- `react-query`: ^5.66.9 - Data fetching

### Peer Dependencies

- `@strapi/strapi`: ^5.0.1
- React 18+
- Styled Components 6+

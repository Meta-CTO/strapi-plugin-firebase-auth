# Changelog

## v1.4.0

[compare changes](https://github.com/Meta-CTO/strapi-plugin-firebase-auth/compare/v1.3.2...v1.4.0)

### 🚀 Enhancements

- Implement activity logging feature ([3bde592](https://github.com/Meta-CTO/strapi-plugin-firebase-auth/commit/3bde592))

### 🩹 Fixes

- Enhance user linking and data handling in autoLinkService and firebaseUserDataService ([158024a](https://github.com/Meta-CTO/strapi-plugin-firebase-auth/commit/158024a))

### 💅 Refactors

- Replace ApplicationError with ValidationError in email, firebase, token, and user services ([013ba28](https://github.com/Meta-CTO/strapi-plugin-firebase-auth/commit/013ba28))

### 🏡 Chore

- **release:** V1.3.2 ([5cebb0a](https://github.com/Meta-CTO/strapi-plugin-firebase-auth/commit/5cebb0a))
- **release:** V1.3.2 - Update package version and add @strapi/utils as a peer dependency ([e0c6850](https://github.com/Meta-CTO/strapi-plugin-firebase-auth/commit/e0c6850))

### ❤️ Contributors

- Felippe George Haeitmann ([@felippegh](https://github.com/felippegh))
- Garrett Fritz

## v1.3.2

[compare changes](https://github.com/Meta-CTO/strapi-plugin-firebase-auth/compare/v1.3.1...v1.3.2)

## v1.3.1

[compare changes](https://github.com/Meta-CTO/strapi-plugin-firebase-auth/compare/v1.3.0...v1.3.1)

## v1.3.0

[compare changes](https://github.com/Meta-CTO/strapi-plugin-firebase-auth/compare/v1.2.2...v1.3.0)

### 🚀 Enhancements

- Add option to include Firebase custom token in email links ([1dbf03d](https://github.com/Meta-CTO/strapi-plugin-firebase-auth/commit/1dbf03d))

### 🩹 Fixes

- Display label for include credentials toggle ([c7beadd](https://github.com/Meta-CTO/strapi-plugin-firebase-auth/commit/c7beadd))

### 🏡 Chore

- **release:** V1.2.2 ([99edab8](https://github.com/Meta-CTO/strapi-plugin-firebase-auth/commit/99edab8))
- Update CHANGELOG.md to refine formatting and remove contributor section ([beebc5e](https://github.com/Meta-CTO/strapi-plugin-firebase-auth/commit/beebc5e))

### ❤️ Contributors

- Garrett Fritz
- Felippe George Haeitmann ([@felippegh](https://github.com/felippegh))

## v1.2.2

[compare changes](https://github.com/Meta-CTO/strapi-plugin-firebase-auth/compare/v1.2.1...v1.2.2)

### Refactors

- Improve email verification handling in firebaseController and firebaseService, enhancing error responses and token validation logic ([6f901d5](https://github.com/Meta-CTO/strapi-plugin-firebase-auth/commit/6f901d5))

### Chore

- Update CHANGELOG.md to improve formatting and remove contributor section ([a48dccb](https://github.com/Meta-CTO/strapi-plugin-firebase-auth/commit/a48dccb))

## v1.2.1

[compare changes](https://github.com/Meta-CTO/strapi-plugin-firebase-auth/compare/v1.2.0...v1.2.1)

### Refactors

- Enhance firebaseController to utilize is-authenticated policy for secure endpoints and improve error handling ([7df3b90](https://github.com/Meta-CTO/strapi-plugin-firebase-auth/commit/7df3b90))

### Chore

- Update CHANGELOG.md to enhance formatting and remove contributor section ([5733a6d](https://github.com/Meta-CTO/strapi-plugin-firebase-auth/commit/5733a6d))

## v1.2.0

[compare changes](https://github.com/Meta-CTO/strapi-plugin-firebase-auth/compare/v1.1.12...v1.2.0)

### Enhancements

- Add email verification functionality with resend option and configuration settings ([30ccab9](https://github.com/Meta-CTO/strapi-plugin-firebase-auth/commit/30ccab9))

### Chore

- Update CHANGELOG.md to standardize formatting and remove contributor section ([1b7dffc](https://github.com/Meta-CTO/strapi-plugin-firebase-auth/commit/1b7dffc))

## v1.1.12

[compare changes](https://github.com/Meta-CTO/strapi-plugin-firebase-auth/compare/v1.1.11...v1.1.12)

### Refactors

- Implement password reset functionality with custom JWT token and email confirmation ([173c106](https://github.com/Meta-CTO/strapi-plugin-firebase-auth/commit/173c106))

### Chore

- Update CHANGELOG.md to standardize formatting and remove unnecessary sections ([c84012d](https://github.com/Meta-CTO/strapi-plugin-firebase-auth/commit/c84012d))

## v1.1.9

[compare changes](https://github.com/Meta-CTO/strapi-plugin-firebase-auth/compare/v1.1.8...v1.1.9)

### Refactors

- Improve error logging and streamline function parameters across services ([a357815](https://github.com/Meta-CTO/strapi-plugin-firebase-auth/commit/a357815))

### Chore

- Clean up CHANGELOG.md by removing contributor section and unnecessary emoji ([35a5af4](https://github.com/Meta-CTO/strapi-plugin-firebase-auth/commit/35a5af4))

## v1.1.8

[compare changes](https://github.com/Meta-CTO/strapi-plugin-firebase-auth/compare/v1.1.7...v1.1.8)

### Chore

- Revert version number in package.json from 1.2.0 to 1.1.7 ([bdad86d](https://github.com/Meta-CTO/strapi-plugin-firebase-auth/commit/bdad86d))
- Update CHANGELOG.md to reflect version 1.1.7 and clean up outdated entries ([19380c5](https://github.com/Meta-CTO/strapi-plugin-firebase-auth/commit/19380c5))
- Remove debug logging from user form components ([9f99221](https://github.com/Meta-CTO/strapi-plugin-firebase-auth/commit/9f99221))

## v1.1.7

[compare changes](https://github.com/Meta-CTO/strapi-plugin-firebase-auth/compare/v1.1.0...v1.2.0)

### Enhancements

- Enhance Firebase integration with improved user linking and password reset flow ([9f8d8f0](https://github.com/Meta-CTO/strapi-plugin-firebase-auth/commit/9f8d8f0))
- Update password reset flow and enhance user management routes in admin API ([18369e9](https://github.com/Meta-CTO/strapi-plugin-firebase-auth/commit/18369e9))
- Update changelog for v1.1.1 with breaking changes, enhancements, and documentation updates ([53895e0](https://github.com/Meta-CTO/strapi-plugin-firebase-auth/commit/53895e0))

### Fixes

- Correct version number and update peer dependencies for compatibility ([9687835](https://github.com/Meta-CTO/strapi-plugin-firebase-auth/commit/9687835))
- Update version number to 1.1.2 in package.json ([5018875](https://github.com/Meta-CTO/strapi-plugin-firebase-auth/commit/5018875))
- Update PhoneInput import and type for phone change handler ([166a89e](https://github.com/Meta-CTO/strapi-plugin-firebase-auth/commit/166a89e))
- Update dependencies in package.json for compatibility ([23048ee](https://github.com/Meta-CTO/strapi-plugin-firebase-auth/commit/23048ee))
- Correct comparison link for v1.1.3 in CHANGELOG.md ([98ecc8d](https://github.com/Meta-CTO/strapi-plugin-firebase-auth/commit/98ecc8d))
- Update API endpoint for fetching Firebase config ([91bb09a](https://github.com/Meta-CTO/strapi-plugin-firebase-auth/commit/91bb09a))
- Update release script to include formatting, building, and verification steps ([560fba0](https://github.com/Meta-CTO/strapi-plugin-firebase-auth/commit/560fba0))
- Add debug logging for component imports and rendering in CreateUserForm, EditUserForm, and UserFormFields ([2009e14](https://github.com/Meta-CTO/strapi-plugin-firebase-auth/commit/2009e14))
- Revert version number in package.json to 1.1.0 ([d18f3d5](https://github.com/Meta-CTO/strapi-plugin-firebase-auth/commit/d18f3d5))

## v1.1.0

[compare changes](https://github.com/Meta-CTO/strapi-plugin-firebase-auth/compare/v1.0.13...v1.1.0)

### Major Features

#### Magic Link Authentication (Passwordless Sign-In)

- Added `POST /api/firebase-authentication/requestMagicLink` endpoint for passwordless authentication
- Configurable magic link settings: enable/disable, URL, email subject, expiry duration
- Three-tier email fallback system: Strapi Email Plugin → Firebase Extension → Console fallback
- Enhanced email templates with magic link notifications

#### Firebase User Data Architecture Refactor

- Introduced `firebase_user_data` table to separate Firebase-specific fields from Strapi users
- Migration script for seamless data transfer from `up_users` to `firebase_user_data`
- Auto-linking service automatically connects Strapi and Firebase users on plugin startup
- New services: `autoLinkService`, `firebaseStrapiLinkService`, `firebaseUserDataService`
- Improved user lookup and creation logic with cleaner separation of concerns

#### Email/Password Direct Login

- Added `POST /api/firebase-authentication/emailLogin` endpoint
- Direct authentication without requiring Firebase SDK on client
- Uses Firebase Identity Toolkit API for validation
- Requires Firebase Web API Key configuration in settings

#### Password Reset Flow

- Added `POST /api/firebase-authentication/forgotPassword` - Request password reset email
- Added `POST /api/firebase-authentication/resetPassword` - Reset password with JWT token
- Customizable password validation with regex and error messages
- Email templates for password reset notifications
- Settings UI for password requirements and reset URL configuration

### Enhancements

#### Security

- **Blocked User Validation**: Prevents blocked users from obtaining authentication tokens
- Enhanced token validation and user status checks

#### Admin UI Improvements

- **Bulk Selection**: Select multiple users for batch operations
- **Table Sorting**: Sort by any column (email, phone, sign-in date, etc.)
- **Search Functionality**: Search users by email, phone, or name
- **Create/Edit Views**: Comprehensive forms for user management
- **Tooltip Fix**: Resolved Radix UI TooltipProvider errors in Strapi v5

#### User Experience

- **Phone Number Support**: Improved username generation from phone numbers
- **Public Config Endpoint**: `GET /api/firebase-authentication/config` for frontend validation
- **Enhanced Error Messages**: Better error handling and user feedback

### Documentation

- Comprehensive README rewrite with step-by-step installation guide
- Enhanced API reference with all endpoints documented
- Added configuration examples and troubleshooting guides

### Technical Improvements

- Updated dependencies (@radix-ui/react-tooltip, firebase-admin)
- Added engine requirements (Node 18-22, npm 6+)
- Enhanced Firebase initialization with better error logging
- Refactored modal components for consistency
- Improved TypeScript configurations

## v1.0.10

[compare changes](https://github.com/Meta-CTO/strapi-plugin-firebase-auth/compare/v1.0.9...v1.0.10)

## v1.0.9

[compare changes](https://github.com/Meta-CTO/strapi-plugin-firebase-auth/compare/v1.0.8...v1.0.9)

## v1.0.8

[compare changes](https://github.com/Meta-CTO/strapi-plugin-firebase-auth/compare/v1.0.7...v1.0.8)

## v1.0.7

[compare changes](https://github.com/Meta-CTO/strapi-plugin-firebase-auth/compare/v1.0.6...v1.0.7)

## v1.0.6

[compare changes](https://github.com/Meta-CTO/strapi-plugin-firebase-auth/compare/v1.0.5...v1.0.6)

## v1.0.5

[compare changes](https://github.com/Meta-CTO/strapi-plugin-firebase-auth/compare/v1.0.4...v1.0.5)

## v1.0.4

[compare changes](https://github.com/Meta-CTO/strapi-plugin-firebase-auth/compare/v1.0.3...v1.0.4)

## v1.0.3

[compare changes](https://github.com/Meta-CTO/strapi-plugin-firebase-auth/compare/v1.0.2...v1.0.3)

## v1.0.2

[compare changes](https://github.com/Meta-CTO/strapi-plugin-firebase-auth/compare/t...v1.0.2)

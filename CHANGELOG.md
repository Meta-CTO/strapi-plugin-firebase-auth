# Changelog

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

/**
 * Constants for Firebase Authentication Plugin
 * This file centralizes all magic strings and configuration defaults
 */

// Plugin identifiers
export const PLUGIN_NAME = "firebase-authentication";
export const PLUGIN_UID = `plugin::${PLUGIN_NAME}`;

// Content types
export const CONFIG_CONTENT_TYPE = `${PLUGIN_UID}.firebase-authentication-configuration`;
export const USER_CONTENT_TYPE = "plugin::users-permissions.user";
export const USER_PERMISSIONS_PLUGIN = "users-permissions";

// Default values
export const DEFAULT_PASSWORD_RESET_URL = "http://localhost:3000/reset-password";
export const DEFAULT_PASSWORD_REGEX = "^.{6,}$";
export const DEFAULT_PASSWORD_MESSAGE = "Password must be at least 6 characters long";
export const DEFAULT_EMAIL_PATTERN = "{randomString}@phone-user.firebase.local";
export const DEFAULT_RESET_EMAIL_SUBJECT = "Reset Your Password";

// API endpoints
export const API_PREFIX = "/api/firebase-authentication";

// Firebase URLs
export const FIREBASE_AUTH_URL = "https://identitytoolkit.googleapis.com/v1/accounts";

// Error messages
export const ERROR_MESSAGES = {
  FIREBASE_NOT_INITIALIZED:
    "Firebase is not initialized. Please upload Firebase service account configuration via Settings → Firebase Authentication.",
  INVALID_JSON: "Invalid JSON format. Please ensure you copied the entire JSON content correctly.",
  MISSING_DATA: "data is missing",
  SOMETHING_WENT_WRONG: "Something went wrong",
  AUTHENTICATION_FAILED: "Authentication failed",
  TOKEN_MISSING: "idToken is missing!",
  EMAIL_PASSWORD_REQUIRED: "Email and password are required",
  PASSWORD_REQUIRED: "Password is required",
  AUTHORIZATION_REQUIRED: "Authorization token is required",
  INVALID_TOKEN: "Invalid or expired token",
  USER_NOT_FOUND: "User not found",
  USER_NO_EMAIL: "User does not have an email address",
  FIREBASE_LINK_FAILED: "Failed to generate Firebase reset link",
  CONFIG_NOT_FOUND: "No config found",
  INVALID_SERVICE_ACCOUNT: "Invalid service account JSON",
  WEB_API_NOT_CONFIGURED: "Email/password authentication is not available. Web API Key is not configured.",
  RESET_URL_NOT_CONFIGURED: "Password reset URL is not configured",
  RESET_URL_MUST_BE_HTTPS: "Password reset URL must use HTTPS in production",
  RESET_URL_INVALID_FORMAT: "Password reset URL is not a valid URL format",
  USER_NOT_LINKED_FIREBASE: "User is not linked to Firebase authentication",
  OVERRIDE_USER_ID_REQUIRED: "Override user ID is required",
  EITHER_EMAIL_OR_PHONE_REQUIRED: "Either email or phoneNumber is required",
  DELETION_NO_CONFIG: "No Firebase configs exists for deletion",
};

// Success messages
export const SUCCESS_MESSAGES = {
  FIREBASE_INITIALIZED: "Firebase successfully initialized",
  FIREBASE_CONFIG_DELETED: "Firebase config deleted and reinitialized",
  PASSWORD_RESET_EMAIL_SENT: "If an account with that email exists, a password reset link has been sent.",
  SERVER_RESTARTING: "SERVER IS RESTARTING",
};

// Configuration keys
export const CONFIG_KEYS = {
  ENCRYPTION_KEY: `${PLUGIN_UID}.FIREBASE_JSON_ENCRYPTION_KEY`,
};

// Field names
export const FIELD_NAMES = {
  FIREBASE_CONFIG_JSON: "firebase_config_json",
  FIREBASE_WEB_API_KEY: "firebase_web_api_key",
  PASSWORD_REGEX: "passwordRequirementsRegex",
  PASSWORD_MESSAGE: "passwordRequirementsMessage",
  PASSWORD_RESET_URL: "passwordResetUrl",
  PASSWORD_RESET_EMAIL_SUBJECT: "passwordResetEmailSubject",
};

// Log levels
export const LOG_LEVELS = {
  DEBUG: "debug",
  INFO: "info",
  WARN: "warn",
  ERROR: "error",
};

// User role types
export const USER_ROLES = {
  DEFAULT_TYPE: "authenticated",
};

// Time constants
export const TIME_CONSTANTS = {
  JWT_EXPIRY: "1h",
  EMAIL_TIMEOUT_MS: 2000,
  FIREBASE_TIMEOUT_MS: 10000,
};

// Firebase error codes
export const FIREBASE_ERROR_CODES = {
  EMAIL_NOT_FOUND: "EMAIL_NOT_FOUND",
  INVALID_PASSWORD: "INVALID_PASSWORD",
  USER_DISABLED: "USER_DISABLED",
  INVALID_EMAIL: "INVALID_EMAIL",
  USER_NOT_FOUND: "auth/user-not-found",
};

// Firebase error messages for user
export const FIREBASE_USER_ERROR_MESSAGES = {
  EMAIL_NOT_FOUND: "User with this email does not exist",
  INVALID_PASSWORD: "Invalid password",
  USER_DISABLED: "User account has been disabled",
  INVALID_EMAIL: "Invalid email format",
  INVALID_LOGIN_CREDENTIALS: "INVALID_LOGIN_CREDENTIALS",
};

// Required fields for validation
export const REQUIRED_FIELDS = {
  SERVICE_ACCOUNT: ["private_key", "client_email", "project_id", "type"],
  WEB_CONFIG: ["apiKey", "authDomain"], // These indicate wrong JSON type
};

// Validation messages
export const VALIDATION_MESSAGES = {
  INVALID_SERVICE_ACCOUNT: "Invalid Service Account JSON. Missing required fields:",
  WRONG_JSON_TYPE:
    "You uploaded a Web App Config (SDK snippet) instead of a Service Account JSON. Please go to Firebase Console → Service Accounts tab → Generate New Private Key to download the correct file.",
  SERVICE_ACCOUNT_HELP:
    "Please download the correct JSON from Firebase Console → Service Accounts → Generate New Private Key. Do NOT use the Web App Config (SDK snippet) - that is a different file!",
};

// Email patterns
export const EMAIL_PATTERNS = {
  APPLE_RELAY: "privaterelay.appleid.com",
};

// Regex patterns
export const REGEX_PATTERNS = {
  PHONE_NUMBER: /^\d{10,15}$/,
  STRAPI_ID: /^\d{1,6}$/,
  PHONE_PREFIX: /^\+/,
};

// Max retry attempts
export const MAX_RETRIES = {
  EMAIL_GENERATION: 3,
  USERNAME_GENERATION: 10,
};

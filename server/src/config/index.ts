/**
 * Config for Firebase Authentication Plugin
 *
 * Available email pattern tokens for phone-only users:
 *
 * {randomString} - Generates 8-character random alphanumeric string (lowercase)
 *                  Example: "a1b2c3d4"
 *
 * {phoneNumber}  - Extracts digits from phone number
 *                  Example: "+1-234-567-8900" → "12345678900"
 *
 * {timestamp}    - Current Unix timestamp in milliseconds
 *                  Example: "1704067200000"
 *
 * Pattern Examples:
 * - "{randomString}@phone-user.firebase.local" → "a1b2c3d4@phone-user.firebase.local"
 * - "phone_{phoneNumber}@myapp.local" → "phone_12345678900@myapp.local"
 * - "user_{timestamp}@temp.local" → "user_1704067200000@temp.local"
 * - "{phoneNumber}_{randomString}@app.com" → "12345678900_a1b2c3d4@app.com"
 *
 * IMPORTANT: Pattern must include at least one of {randomString} or {timestamp}
 *            to ensure uniqueness across multiple users.
 */
export type FirebaseAuthConfig = {
  /**
   * Any key to encrypt the firebase json file
   *
   * @default 'your-key-here'
   */
  firebaseJsonEncryptionKey: string;

  /**
   * Whether to generate dummy emails for phone-only users
   *
   * @default true
   */
  emailRequired?: boolean;

  /**
   * Template pattern for generating dummy emails
   * Must include {randomString} or {timestamp} for uniqueness
   *
   * @default '{randomString}@phone-user.firebase.local'
   */
  emailPattern?: string;
};

export default {
  default: ({ env }) => ({
    firebaseJsonEncryptionKey: env("FIREBASE_JSON_ENCRYPTION_KEY", "your-key-here"),
    emailRequired: env.bool("FIREBASE_EMAIL_REQUIRED", false),
    emailPattern: "{randomString}@phone-user.firebase.local",
  }),
  validator(config: FirebaseAuthConfig) {
    if (!config.firebaseJsonEncryptionKey) {
      throw new Error("FIREBASE_JSON_ENCRYPTION_KEY is required for Firebase Auth to work");
    }

    // Validate emailPattern when emailRequired is true
    if (config.emailRequired) {
      if (!config.emailPattern || config.emailPattern.trim() === "") {
        throw new Error(
          "[Firebase Auth Plugin] emailPattern is required when emailRequired is true.\n" +
            "Available tokens: {randomString}, {phoneNumber}, {timestamp}\n" +
            'Example: "phone_{phoneNumber}_{randomString}@myapp.local"'
        );
      }

      // Ensure pattern includes uniqueness tokens
      const hasUniqueness =
        config.emailPattern.includes("{randomString}") || config.emailPattern.includes("{timestamp}");

      if (!hasUniqueness) {
        throw new Error(
          "[Firebase Auth Plugin] emailPattern must include {randomString} or {timestamp} for uniqueness.\n" +
            `Your pattern: "${config.emailPattern}"\n` +
            "Valid examples:\n" +
            '  - "phone_{phoneNumber}_{randomString}@myapp.local"\n' +
            '  - "user_{timestamp}@temp.local"\n' +
            '  - "{randomString}@phone-user.firebase.local"'
        );
      }
    }
  },
};

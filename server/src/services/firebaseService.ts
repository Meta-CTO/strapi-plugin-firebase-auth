import { errors } from "@strapi/utils";
import { processMeData } from "../utils/fetch-me";
import { generateReferralCode } from "../utils";

// Default email pattern - matches the default in server/config/index.ts
const DEFAULT_EMAIL_PATTERN = "{randomString}@phone-user.firebase.local";

/**
 * Normalize email for consistent lookup and storage
 * Prevents whitespace bypass attacks (e.g., " user@example.com " != "user@example.com")
 * @param email - Email address to normalize
 * @returns Normalized email (trimmed and lowercased) or null if input is falsy
 */
const normalizeEmail = (email: string | null | undefined): string | null => {
  if (!email) return null;
  return email.trim().toLowerCase();
};

/**
 * Generate a fake email for phone-only users based on configured pattern
 * @param phoneNumber - Optional phone number (e.g., "+1-234-567-8900")
 * @param pattern - Optional email pattern template with tokens
 * @returns Generated unique email address
 * @throws Error if unable to generate unique email after MAX_RETRIES attempts
 */
const createFakeEmail = async (phoneNumber?: string, pattern?: string) => {
  const MAX_RETRIES = 3;
  let retryCount = 0;

  const emailPattern = pattern || DEFAULT_EMAIL_PATTERN;

  while (retryCount < MAX_RETRIES) {
    const randomString = generateReferralCode(8).toLowerCase();
    const timestamp = Date.now().toString();
    const phoneDigits = phoneNumber ? phoneNumber.replace(/[^0-9]/g, "") : "";

    let fakeEmail = emailPattern
      .replace("{randomString}", randomString)
      .replace("{timestamp}", timestamp)
      .replace("{phoneNumber}", phoneDigits);

    const existingUser = await strapi.db.query("plugin::users-permissions.user").findOne({
      where: { email: fakeEmail },
    });

    if (!existingUser) {
      return fakeEmail;
    }

    retryCount++;
  }

  throw new errors.ValidationError(
    `[Firebase Auth Plugin] Failed to generate unique email after ${MAX_RETRIES} attempts.\n` +
      `Pattern used: "${emailPattern}"\n` +
      `Phone number: "${phoneNumber || "N/A"}"\n\n` +
      `This usually means your emailPattern doesn't include enough uniqueness.\n` +
      `Make sure your pattern includes {randomString} or {timestamp} tokens.\n\n` +
      `Valid pattern examples:\n` +
      `  - "phone_{phoneNumber}_{randomString}@myapp.local"\n` +
      `  - "user_{timestamp}@temp.local"\n` +
      `  - "{randomString}@phone-user.firebase.local"`
  );
};

/**
 * Generate a valid username from an email address
 * Username must be 5-20 characters and contain only letters, numbers, dots, underscores, and hyphens
 * @param email - Email address (e.g., "test+something@example.com")
 * @returns Valid unique username
 * @throws Error if unable to generate unique username after MAX_RETRIES attempts
 */
const generateUsernameFromEmail = async (email: string): Promise<string> => {
  const MAX_RETRIES = 10;

  // Get the part before @
  const emailPrefix = email.split("@")[0];

  // Remove invalid characters (keep only letters, numbers, dots, underscores, hyphens)
  let sanitizedPrefix = emailPrefix.replace(/[^a-zA-Z0-9._-]/g, "");

  // If sanitized prefix is empty, generate random username
  if (!sanitizedPrefix) {
    sanitizedPrefix = "user" + Math.random().toString(36).substring(2, 8);
  }

  // Truncate to 20 characters max
  let username = sanitizedPrefix.substring(0, 20);

  // Ensure minimum length of 5 characters
  if (username.length < 5) {
    // Pad with random characters
    const randomSuffix = Math.random()
      .toString(36)
      .substring(2, 7 - username.length);
    username = username + randomSuffix;
  }

  // Check if username already exists
  const existingUser = await strapi.db
    .query("plugin::users-permissions.user")
    .findOne({ where: { username } });

  if (!existingUser) {
    return username;
  }

  // Username collision - try adding random suffixes
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    // Take first 15 chars + underscore + 4 random chars = max 20 chars
    const basePart = sanitizedPrefix.substring(0, 15);
    const randomPart = Math.random().toString(36).substring(2, 6);
    const collisionUsername = `${basePart}_${randomPart}`;

    const existingCollisionUser = await strapi.db
      .query("plugin::users-permissions.user")
      .findOne({ where: { username: collisionUsername } });

    if (!existingCollisionUser) {
      return collisionUsername;
    }
  }

  throw new errors.ValidationError(
    `[Firebase Auth Plugin] Failed to generate unique username from email after ${MAX_RETRIES} attempts.\n` +
      `Email: "${email}"`
  );
};

/**
 * Generate a valid username from a phone number
 * Username must be 5-20 characters and contain only letters, numbers, dots, underscores, and hyphens
 * @param phoneNumber - Phone number (e.g., "+5543999662203")
 * @returns Valid unique username
 * @throws Error if unable to generate unique username after MAX_RETRIES attempts
 */
const generateUsernameFromPhone = async (phoneNumber: string): Promise<string> => {
  const MAX_RETRIES = 10;

  // Strip all non-numeric characters
  const phoneDigits = phoneNumber.replace(/[^0-9]/g, "");

  // Truncate to 20 characters if needed (username max length)
  let username = phoneDigits.substring(0, 20);

  // Ensure minimum length of 5 characters
  if (username.length < 5) {
    // Pad with random digits if phone number is too short
    const randomDigits = Math.random()
      .toString()
      .substring(2, 7 - username.length);
    username = username + randomDigits;
  }

  // Try to use phone digits as username first
  const existingUser = await strapi.db
    .query("plugin::users-permissions.user")
    .findOne({ where: { username } });

  if (!existingUser) {
    return username;
  }

  // Username collision - try adding random suffixes
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    // Take first 16 digits + underscore + 3 random characters = max 20 chars
    const phonePart = phoneDigits.substring(0, 16);
    const randomPart = Math.random().toString(36).substring(2, 5);
    const collisionUsername = `${phonePart}_${randomPart}`;

    const existingCollisionUser = await strapi.db
      .query("plugin::users-permissions.user")
      .findOne({ where: { username: collisionUsername } });

    if (!existingCollisionUser) {
      return collisionUsername;
    }
  }

  throw new errors.ValidationError(
    `[Firebase Auth Plugin] Failed to generate unique username from phone number after ${MAX_RETRIES} attempts.\n` +
      `Phone number: "${phoneNumber}"`
  );
};

/**
 * Validates that a Strapi user is not blocked
 * @param user - Strapi user object to validate
 * @throws ForbiddenError if user is blocked
 */
const validateUserNotBlocked = (user: any) => {
  if (user?.blocked === true) {
    strapi.log.warn(`Blocked user attempted authentication`, {
      userId: user.documentId,
      email: user.email || "no-email",
      username: user.username,
    });
    throw new errors.ForbiddenError("Your account has been blocked. Please contact support for assistance.");
  }
};

export default ({ strapi }) => ({
  async getUserAttributes() {
    return strapi.plugin("users-permissions").contentType("user").attributes;
  },
  delete: async (entityId) => {
    await strapi.firebase.auth().deleteUser(entityId);
    return { success: true };
  },

  validateExchangeTokenPayload: async (requestPayload) => {
    const { idToken } = requestPayload;
    strapi.log.debug("Validating idToken:", idToken?.substring(0, 20) + "...");

    if (!idToken || idToken.length === 0) {
      throw new errors.ValidationError("idToken is missing!");
    }

    try {
      const decodedToken = await strapi.firebase.auth().verifyIdToken(idToken);
      if (!decodedToken) {
        throw new Error("Token verification returned null");
      }
      return decodedToken;
    } catch (error) {
      strapi.log.error("Firebase token verification failed:", {
        error: error.message,
        stack: error.stack,
      });
      throw new errors.UnauthorizedError(`Firebase authentication failed: ${error.message}`);
    }
  },

  decodeIDToken: async (idToken) => {
    return await strapi.firebase.auth().verifyIdToken(idToken);
  },

  overrideFirebaseAccess: async (overrideUserId: string, populate?: string[]) => {
    if (!overrideUserId) {
      throw new errors.ValidationError("Override user ID is required");
    }

    const user = await strapi.plugin("users-permissions").service("user").fetch(overrideUserId);

    if (!user) {
      throw new errors.NotFoundError("User not found");
    }

    const jwt = await strapi.plugin("users-permissions").service("jwt").issue({
      id: user.id,
    });

    return {
      user: await processMeData(user, populate),
      jwt,
    };
  },

  async checkIfUserExists(decodedToken) {
    const firebaseUID = decodedToken.user_id || decodedToken.uid;

    // Primary lookup: firebase_user_data table by Firebase UID
    const firebaseData = await strapi
      .plugin("firebase-authentication")
      .service("firebaseUserDataService")
      .getByFirebaseUID(firebaseUID);

    if (firebaseData && firebaseData.user) {
      validateUserNotBlocked(firebaseData.user);
      return firebaseData.user; // Already populated by service
    }

    // Fallback 1: Email lookup (for users not yet migrated or created before plugin)
    if (decodedToken.email) {
      // Normalize email to prevent whitespace bypass attacks
      const normalizedEmail = normalizeEmail(decodedToken.email);
      const userByEmail = await strapi.db.query("plugin::users-permissions.user").findOne({
        where: { email: normalizedEmail },
        populate: ["role"],
      });

      if (userByEmail) {
        validateUserNotBlocked(userByEmail);

        // Check if Firebase UID is already linked before attempting to create
        const existingLink = await strapi
          .plugin("firebase-authentication")
          .service("firebaseUserDataService")
          .getByFirebaseUID(firebaseUID);

        if (existingLink && existingLink.user) {
          validateUserNotBlocked(existingLink.user);
          return existingLink.user;
        }

        // Safe to link now - Firebase UID not linked to anyone
        await strapi
          .plugin("firebase-authentication")
          .service("firebaseUserDataService")
          .updateForUser(userByEmail.documentId, { firebaseUserID: firebaseUID });
        strapi.log.info(`Auto-linked user ${userByEmail.username} to Firebase UID ${firebaseUID}`);

        return userByEmail;
      }

      // Check appleEmail fallback (for Apple Sign-In users)
      const firebaseDataByApple = await strapi
        .documents("plugin::firebase-authentication.firebase-user-data")
        .findMany({
          filters: { appleEmail: { $eq: decodedToken.email } },
          populate: {
            user: {
              populate: ["role"],
            },
          },
        });

      const userByAppleEmail = firebaseDataByApple?.[0]?.user || null;

      if (userByAppleEmail) {
        validateUserNotBlocked(userByAppleEmail);

        // Check if Firebase UID is already linked before attempting to create
        const existingLink = await strapi
          .plugin("firebase-authentication")
          .service("firebaseUserDataService")
          .getByFirebaseUID(firebaseUID);

        if (existingLink && existingLink.user) {
          validateUserNotBlocked(existingLink.user);
          return existingLink.user;
        }

        // Safe to link now - Firebase UID not linked to anyone
        await strapi
          .plugin("firebase-authentication")
          .service("firebaseUserDataService")
          .updateForUser(userByAppleEmail.documentId, { firebaseUserID: firebaseUID });
        strapi.log.info(`Auto-linked Apple user ${userByAppleEmail.username} to Firebase UID ${firebaseUID}`);

        return userByAppleEmail;
      }
    }

    // Fallback 2: Phone lookup (for phone auth)
    if (decodedToken.phone_number) {
      const userByPhone = await strapi.db.query("plugin::users-permissions.user").findOne({
        where: { phoneNumber: decodedToken.phone_number },
        populate: ["role"],
      });

      if (userByPhone) {
        validateUserNotBlocked(userByPhone);

        // Check if Firebase UID is already linked before attempting to create
        const existingLink = await strapi
          .plugin("firebase-authentication")
          .service("firebaseUserDataService")
          .getByFirebaseUID(firebaseUID);

        if (existingLink && existingLink.user) {
          validateUserNotBlocked(existingLink.user);
          return existingLink.user;
        }

        // Safe to link now - Firebase UID not linked to anyone
        await strapi
          .plugin("firebase-authentication")
          .service("firebaseUserDataService")
          .updateForUser(userByPhone.documentId, { firebaseUserID: firebaseUID });
        strapi.log.info(`Auto-linked phone user ${userByPhone.username} to Firebase UID ${firebaseUID}`);

        return userByPhone;
      }
    }

    // No user found
    return null;
  },

  fetchUser: async (decodedToken) => {
    // Use firebase_user_data table for lookup
    const firebaseData = await strapi
      .plugin("firebase-authentication")
      .service("firebaseUserDataService")
      .getByFirebaseUID(decodedToken.uid);

    if (!firebaseData || !firebaseData.user) {
      throw new errors.ValidationError("User not found");
    }

    return firebaseData.user;
  },

  generateJWTForCurrentUser: async (user) => {
    return strapi.plugin("users-permissions").service("jwt").issue({
      id: user.id,
    });
  },

  async createStrapiUser(decodedToken, idToken, profileMetaData) {
    // PRE-CHECK: Ensure Firebase UID isn't already linked to another user
    // This prevents the "same person, two accounts" scenario from race conditions
    const existingLink = await strapi
      .plugin("firebase-authentication")
      .service("firebaseUserDataService")
      .getByFirebaseUID(decodedToken.uid);

    if (existingLink && existingLink.user) {
      strapi.log.warn(
        `[Duplicate Prevention] Firebase UID ${decodedToken.uid} already linked to user ` +
          `${existingLink.user.email || existingLink.user.documentId}. Returning existing user instead of creating new one.`
      );
      return existingLink.user;
    }

    // Prepare user payload OUTSIDE transaction (async operations like username generation)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userPayload: any = {};

    const pluginStore = await strapi.store({
      environment: "",
      type: "plugin",
      name: "users-permissions",
    });

    const settings = await pluginStore.get({
      key: "advanced",
    });

    const role = await strapi.db
      .query("plugin::users-permissions.role")
      .findOne({ where: { type: settings.default_role } });
    userPayload.role = role.id;
    // NO firebaseUserID here - it goes in firebase_user_data table
    userPayload.confirmed = true;
    userPayload.provider = "firebase";

    // Normalize email from Firebase token to prevent whitespace bypass
    userPayload.email = normalizeEmail(decodedToken.email);
    userPayload.phoneNumber = decodedToken.phone_number;
    // NO idToken stored - Firebase best practice: verify and discard
    if (profileMetaData) {
      userPayload.firstName = profileMetaData?.firstName;
      userPayload.lastName = profileMetaData?.lastName;
      userPayload.phoneNumber = profileMetaData?.phoneNumber;
    }

    let appleEmail = null;
    if (decodedToken.email) {
      // Generate a valid username from the email
      userPayload.username = await generateUsernameFromEmail(decodedToken.email);

      // Check for Apple Private Relay email - store in firebase_user_data, not user table
      const emailComponents = decodedToken.email.split("@");
      if (emailComponents[1].includes("privaterelay.appleid.com")) {
        appleEmail = decodedToken.email;
      }
    } else {
      // Phone-only user - generate valid username from phone number
      userPayload.username = await generateUsernameFromPhone(userPayload.phoneNumber);

      const emailRequired = strapi.plugin("firebase-authentication").config("emailRequired");
      const emailPattern = strapi.plugin("firebase-authentication").config("emailPattern");

      if (profileMetaData?.email) {
        // Use email from profileMetaData if provided (normalized)
        userPayload.email = normalizeEmail(profileMetaData.email);
      } else if (emailRequired) {
        // Generate fake email using configured pattern
        userPayload.email = await createFakeEmail(userPayload.phoneNumber, emailPattern);
      } else {
        // Allow null email
        userPayload.email = null;
      }
    }

    // Wrap user creation + Firebase link in transaction for atomicity
    // If linking fails, user creation is automatically rolled back
    try {
      return await strapi.db.transaction(async () => {
        // Step 1: Create Strapi user (no Firebase-specific fields)
        const newUser = await strapi.db.query("plugin::users-permissions.user").create({ data: userPayload });

        // Step 2: Link Firebase UID and appleEmail to Strapi user in firebase_user_data table
        const firebaseDataPayload: any = { firebaseUserID: decodedToken.uid };
        if (appleEmail) {
          firebaseDataPayload.appleEmail = appleEmail;
        }

        await strapi
          .plugin("firebase-authentication")
          .service("firebaseUserDataService")
          .updateForUser(newUser.documentId, firebaseDataPayload);

        strapi.log.info(`Created user ${newUser.username} and linked to Firebase UID ${decodedToken.uid}`);

        return newUser;
      });
    } catch (error) {
      // Handle race condition: duplicate firebaseUserID from concurrent requests
      if (error.code === "23505" || error.message?.includes("unique constraint")) {
        // PostgreSQL unique constraint violation - another request won the race
        strapi.log.warn(
          `[Race Condition] User creation conflict for Firebase UID ${decodedToken.uid}. ` +
            `Another concurrent request created the user first. Retrying lookup...`
        );

        // Retry lookup - the concurrent request should have succeeded
        const existingUser = await strapi
          .plugin("firebase-authentication")
          .service("firebaseService")
          .checkIfUserExists(decodedToken);

        if (existingUser) {
          strapi.log.info(
            `[Race Condition] Successfully found user ${existingUser.username} ` +
              `created by concurrent request`
          );
          return existingUser;
        }

        // If still not found after retry, log and fall through to throw error
        strapi.log.error(
          `[Race Condition] Failed to find user after race condition retry for ` +
            `Firebase UID ${decodedToken.uid}`
        );
      }

      // Transaction automatically rolled back - no manual cleanup needed
      throw error;
    }
  },

  validateFirebaseToken: async (idToken: string, profileMetaData?: any, populate?: string[]) => {
    strapi.log.debug("validateFirebaseToken called");

    // Validate and decode the token in one operation
    const decodedToken = await strapi
      .plugin("firebase-authentication")
      .service("firebaseService")
      .validateExchangeTokenPayload({ idToken });

    // Check if user exists
    let user = await strapi
      .plugin("firebase-authentication")
      .service("firebaseService")
      .checkIfUserExists(decodedToken, profileMetaData);

    if (!user) {
      // Create Strapi user if doesn't exist
      user = await strapi
        .plugin("firebase-authentication")
        .service("firebaseService")
        .createStrapiUser(decodedToken, idToken, profileMetaData);
    } else {
      validateUserNotBlocked(user);
    }

    // Generate JWT
    const jwt = await strapi
      .plugin("firebase-authentication")
      .service("firebaseService")
      .generateJWTForCurrentUser(user);

    // Note: idToken is NOT stored anywhere (Firebase best practice: verify and discard)

    return {
      user: await processMeData(user, populate || []),
      jwt,
      uid: decodedToken.uid, // Firebase UID for activity logging
    };
  },

  /**
   * Authenticates a user with email and password through Firebase Identity Toolkit API
   *
   * @param ctx - Koa context object containing the HTTP request and response
   * @returns Response object containing user and JWT token
   *
   * @throws ValidationError - When email/password are missing or invalid
   * @throws ApplicationError - When Firebase Web API key is not configured or authentication fails
   *
   * @example
   * ```typescript
   * // Request
   * POST /api/firebase-authentication/emailLogin
   * {
   *   "email": "user@example.com",
   *   "password": "securePassword123"
   * }
   *
   * // Response
   * {
   *   "user": {
   *     "id": 1,
   *     "email": "user@example.com",
   *     "username": "user",
   *     "confirmed": true,
   *     "blocked": false
   *   },
   *   "jwt": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   * }
   * ```
   *
   * @remarks
   * This method acts as a proxy to Firebase's REST API, eliminating the need for
   * Firebase SDK on the client. It performs the following steps:
   * 1. Validates email and password inputs
   * 2. Retrieves Firebase Web API key from configuration
   * 3. Calls Firebase Identity Toolkit API for authentication
   * 4. Processes Firebase response and handles errors
   * 5. Looks up or creates Strapi user
   * 6. Generates and returns Strapi JWT token
   */
  emailLogin: async (email: string, password: string, populate?: string[]) => {
    strapi.log.debug("emailLogin endpoint called");

    if (!email || !password) {
      throw new errors.ValidationError("Email and password are required");
    }

    // Get Firebase Web API key from settings
    const config = await strapi
      .plugin("firebase-authentication")
      .service("settingsService")
      .getFirebaseConfigJson();

    if (!config || !config.firebaseWebApiKey) {
      throw new errors.ValidationError(
        "Email/password authentication is not available. Web API Key is not configured.\n\n" +
          "To enable email/password authentication:\n" +
          "1. Go to Firebase Console > Project Settings > General\n" +
          "2. Copy your Web API Key\n" +
          "3. Add it in Strapi Admin > Settings > Firebase Authentication > Optional Settings\n\n" +
          "Alternatively, use Firebase Client SDK for authentication and exchange the ID token."
      );
    }

    try {
      // Call Firebase Identity Toolkit API
      const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${config.firebaseWebApiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            password,
            returnSecureToken: true,
          }),
        }
      );

      const data: any = await response.json();

      if (!response.ok) {
        // Handle Firebase errors
        const errorMessage = data.error?.message || "Authentication failed";
        strapi.log.error("Firebase authentication error:", errorMessage);

        // Return specific error messages
        if (errorMessage === "EMAIL_NOT_FOUND") {
          throw new errors.ValidationError("User with this email does not exist");
        } else if (errorMessage === "INVALID_PASSWORD") {
          throw new errors.ValidationError("Invalid password");
        } else if (errorMessage === "USER_DISABLED") {
          throw new errors.ValidationError("User account has been disabled");
        } else if (errorMessage === "INVALID_EMAIL") {
          throw new errors.ValidationError("Invalid email format");
        } else {
          throw new errors.ValidationError(errorMessage);
        }
      }

      // We now have the idToken from Firebase
      const { idToken, refreshToken, localId } = data;

      // Validate and decode the token using the same method for consistency
      const decodedToken = await strapi
        .plugin("firebase-authentication")
        .service("firebaseService")
        .validateExchangeTokenPayload({ idToken });

      // Check if user exists in Strapi
      let user = await strapi
        .plugin("firebase-authentication")
        .service("firebaseService")
        .checkIfUserExists(decodedToken);

      if (!user) {
        // Create Strapi user if doesn't exist
        user = await strapi
          .plugin("firebase-authentication")
          .service("firebaseService")
          .createStrapiUser(decodedToken, idToken, null);
      } else {
        validateUserNotBlocked(user);
      }

      // Generate Strapi JWT
      const jwt = await strapi
        .plugin("firebase-authentication")
        .service("firebaseService")
        .generateJWTForCurrentUser(user);

      // Note: idToken is NOT stored anywhere (Firebase best practice: verify and discard)

      // Return same format as validateFirebaseToken
      return {
        user: await processMeData(user, populate || []),
        jwt,
        uid: decodedToken.uid, // Firebase UID for activity logging
      };
    } catch (error) {
      strapi.log.error("emailLogin error:", error);
      if (error instanceof errors.ValidationError || error instanceof errors.ApplicationError) {
        throw error;
      }
      throw new errors.ApplicationError("Authentication failed");
    }
  },

  /**
   * Forgot password flow - sends reset email with custom JWT token
   * Public endpoint that sends a password reset email with a custom token
   * The token links to your frontend app, not Firebase's hosted UI
   */
  forgotPassword: async (email: string) => {
    strapi.log.info(`[forgotPassword] Starting password reset for email: ${email}`);

    if (!email) {
      throw new errors.ValidationError("Email is required");
    }

    // Get reset URL from config
    const config = await strapi
      .plugin("firebase-authentication")
      .service("settingsService")
      .getFirebaseConfigJson();

    const resetUrl = config?.passwordResetUrl;
    if (!resetUrl) {
      throw new errors.ValidationError("Password reset URL is not configured");
    }

    // Validate URL security in production
    if (process.env.NODE_ENV === "production" && !resetUrl.startsWith("https://")) {
      throw new errors.ValidationError("Password reset URL must use HTTPS in production");
    }

    // Validate URL format
    try {
      new URL(resetUrl);
    } catch (error) {
      throw new errors.ValidationError("Password reset URL is not a valid URL format");
    }

    try {
      // Try to find user in Firebase
      let firebaseUser;
      try {
        firebaseUser = await strapi.firebase.auth().getUserByEmail(email);
      } catch (fbError) {
        // Firebase user not found
        strapi.log.debug("User not found in Firebase");
      }

      if (!firebaseUser) {
        strapi.log.warn(`⚠️ [forgotPassword] User not found in Firebase for email: ${email}`);
        // Security: Don't reveal if email exists or not
        return { message: "If an account with that email exists, a password reset link has been sent." };
      }

      // Get the firebase-user-data record
      const firebaseData = await strapi
        .plugin("firebase-authentication")
        .service("firebaseUserDataService")
        .getByFirebaseUID(firebaseUser.uid);

      if (!firebaseData) {
        strapi.log.warn(`⚠️ [forgotPassword] No firebase-user-data record for: ${email}`);
        // Security: Don't reveal if email exists or not
        return { message: "If an account with that email exists, a password reset link has been sent." };
      }

      strapi.log.info(
        `✅ [forgotPassword] User found: ${JSON.stringify({
          firebaseUID: firebaseUser.uid,
          email: firebaseUser.email,
        })}`
      );

      // Generate custom JWT token using tokenService
      const tokenService = strapi.plugin("firebase-authentication").service("tokenService");
      const token = await tokenService.generateResetToken(firebaseData.documentId);

      // Build the reset link using admin-configured URL + our token
      let resetLink = `${resetUrl}?token=${token}`;

      // If credentials should be included, generate Firebase custom token
      if (config?.includeCredentialsInPasswordResetLink) {
        try {
          const customToken = await strapi.firebase.auth().createCustomToken(firebaseUser.uid);
          resetLink = `${resetLink}&fjwt=${customToken}`;
          strapi.log.info(`[forgotPassword] Added Firebase custom token to reset link`);
        } catch (tokenError: any) {
          strapi.log.warn(`[forgotPassword] Could not generate custom token: ${tokenError.message}`);
          // Continue with link without token
        }
      }

      strapi.log.info(`✅ [forgotPassword] Custom reset link generated for ${email}`);

      // Send email using our three-tier fallback system
      strapi.log.info(`[forgotPassword] Attempting to send password reset email to: ${email}`);
      await strapi
        .plugin("firebase-authentication")
        .service("emailService")
        .sendPasswordResetEmail(firebaseUser, resetLink);

      strapi.log.info(`✅ [forgotPassword] Password reset email sent successfully to: ${email}`);

      // Security: Always return same message
      return {
        message: "If an account with that email exists, a password reset link has been sent.",
      };
    } catch (error) {
      strapi.log.error(
        `❌ [forgotPassword] ERROR: ${JSON.stringify({
          email,
          message: error.message,
          code: error.code,
          name: error.name,
          stack: error.stack,
        })}`
      );
      // Security: Don't reveal internal errors
      return {
        message: "If an account with that email exists, a password reset link has been sent.",
      };
    }
  },

  /**
   * Reset password with authenticated JWT
   * Allows authenticated users (or admins) to change a user's Firebase password
   *
   * @param ctx - Koa context with JWT in Authorization header and new password in body
   * @returns User object and fresh JWT for auto-login
   *
   * @remarks
   * Use cases:
   * 1. Admin-initiated password reset (via admin panel)
   * 2. User-initiated password change (when already authenticated)
   *
   * NOT used for forgot password email flow - that now uses Firebase's hosted UI
   *
   * @param password - New password to set
   * @param user - Authenticated user from ctx.state.user (populated by is-authenticated policy)
   * @param populate - Fields to populate in response
   */
  resetPassword: async (password: string, user: any, populate: any[]) => {
    if (!password) {
      throw new errors.ValidationError("Password is required");
    }

    // User already authenticated by policy - just validate it exists
    if (!user || !user.id) {
      throw new errors.UnauthorizedError("Authentication required");
    }

    // Get configuration
    const config = await strapi
      .plugin("firebase-authentication")
      .service("settingsService")
      .getFirebaseConfigJson();

    // Validate password against configured regex (with schema default fallback)
    const passwordRegex = config?.passwordRequirementsRegex || "^.{6,}$";
    const passwordMessage =
      config?.passwordRequirementsMessage || "Password must be at least 6 characters long";

    const regex = new RegExp(passwordRegex);
    if (!regex.test(password)) {
      throw new errors.ValidationError(passwordMessage);
    }

    try {
      // User is already authenticated by policy - ctx.state.user has the basic user info
      // Fetch fresh user data to ensure we have latest state
      const strapiUser = await strapi.db.query("plugin::users-permissions.user").findOne({
        where: { id: user.id },
      });

      if (!strapiUser) {
        throw new errors.NotFoundError("User not found");
      }

      validateUserNotBlocked(strapiUser);

      // Get Firebase UID from firebase_user_data table
      const firebaseData = await strapi
        .plugin("firebase-authentication")
        .service("firebaseUserDataService")
        .findOrCreateForUser(strapiUser.documentId)
        .catch(() => null);

      if (!firebaseData || !firebaseData.firebaseUserID) {
        throw new errors.ValidationError("User is not linked to Firebase authentication");
      }

      // Update Firebase password using Firebase UID from firebase_user_data
      await strapi.firebase.auth().updateUser(firebaseData.firebaseUserID, {
        password,
      });

      // Revoke all refresh tokens (best-effort, don't block on failure)
      try {
        await strapi.firebase.auth().revokeRefreshTokens(firebaseData.firebaseUserID);
      } catch (revokeError: any) {
        strapi.log.warn(`Session revocation failed: ${revokeError.message}`);
      }

      // Send password changed confirmation email (don't block on failure)
      try {
        const firebaseUser = await strapi.firebase.auth().getUser(firebaseData.firebaseUserID);
        const emailService = strapi.plugin("firebase-authentication").service("emailService");
        await emailService.sendPasswordChangedEmail(firebaseUser);
      } catch (emailError: any) {
        strapi.log.warn(`Could not send password changed confirmation: ${emailError.message}`);
      }

      // Generate fresh JWT for auto-login using numeric id
      const jwtService = strapi.plugin("users-permissions").service("jwt");
      const jwt = jwtService.issue({
        id: strapiUser.id, // Use numeric id for consistency
      });

      // Return user + JWT (same format as validateFirebaseToken)
      return {
        user: await processMeData(strapiUser, populate),
        jwt,
        uid: firebaseData.firebaseUserID, // Firebase UID for activity logging
      };
    } catch (error) {
      strapi.log.error("resetPassword error:", error);
      if (error instanceof errors.ValidationError || error instanceof errors.UnauthorizedError) {
        throw error;
      }
      throw new errors.ApplicationError("Failed to reset password");
    }
  },

  /**
   * Request Magic Link for passwordless authentication
   * Generates a sign-in link using Firebase Admin SDK
   * Note: Verification requires client-side completion
   */
  async requestMagicLink(email: string) {
    // Input validation
    if (!email || typeof email !== "string") {
      throw new errors.ValidationError("Valid email is required");
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new errors.ValidationError("Invalid email format");
    }

    // Get configuration
    const config = await strapi.db
      .query("plugin::firebase-authentication.firebase-authentication-configuration")
      .findOne({ where: {} });

    // Check if magic link is enabled
    if (!config?.enableMagicLink) {
      throw new errors.ValidationError(
        "Magic link authentication is not enabled. Enable it in Settings > Firebase Authentication"
      );
    }

    const magicLinkUrl =
      config.magicLinkUrl || `${process.env.PUBLIC_URL || "http://localhost:1338"}/verify-magic-link.html`;

    try {
      // ActionCodeSettings for Firebase
      const actionCodeSettings = {
        url: magicLinkUrl,
        handleCodeInApp: true, // Required for magic links
        // Optional: mobile app support can be added here
        // iOS: { bundleId: 'com.example.ios' },
        // android: {
        //   packageName: 'com.example.android',
        //   installApp: true,
        //   minimumVersion: '12'
        // },
      };

      // Generate magic link using Firebase Admin SDK
      const magicLink = await strapi.firebase.auth().generateSignInWithEmailLink(email, actionCodeSettings);

      // Development logging
      if (process.env.NODE_ENV !== "production") {
        strapi.log.info("Magic Link Generation Request:");
        strapi.log.info(`   Email: ${email}`);
        strapi.log.info(`   Verification URL: ${magicLinkUrl}`);
        strapi.log.info(`   Expires: ${config.magicLinkExpiryHours || 1} hour(s)`);
      }

      // Send email using the email service with three-tier fallback
      const emailResult = await strapi
        .plugin("firebase-authentication")
        .service("emailService")
        .sendMagicLinkEmail(email, magicLink, config);

      // Security: Always return same message to prevent email enumeration
      return {
        success: true,
        message: "If an account exists with that email, a sign-in link has been sent.",
        requiresFrontend: true,
        verificationUrl: magicLinkUrl,
        // Only in development
        ...(process.env.NODE_ENV === "development" && {
          debug: {
            linkSent: emailResult.success,
            email: email,
            message: emailResult.message,
          },
        }),
      };
    } catch (error) {
      strapi.log.error("requestMagicLink error:", error);

      // If it's a Firebase error, it might be a configuration issue
      if (error.code === "auth/operation-not-allowed") {
        throw new errors.ValidationError(
          "Magic link sign-in is not enabled in Firebase Console. " +
            "Please enable Email/Password provider and Email link sign-in method."
        );
      }

      // Security: Don't reveal specific Firebase errors to client
      return {
        success: true,
        message: "If an account exists with that email, a sign-in link has been sent.",
        requiresFrontend: true,
        verificationUrl: magicLinkUrl,
      };
    }
  },

  /**
   * Send email verification - public endpoint
   * Generates a verification token and sends an email to the user
   * Security: Always returns generic success message to prevent email enumeration
   */
  async sendVerificationEmail(email: string) {
    strapi.log.info(`[sendVerificationEmail] Starting email verification for: ${email}`);

    if (!email) {
      throw new errors.ValidationError("Email is required");
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new errors.ValidationError("Invalid email format");
    }

    // Get verification URL from config
    const config = await strapi
      .plugin("firebase-authentication")
      .service("settingsService")
      .getFirebaseConfigJson();

    const verificationUrl = config?.emailVerificationUrl;
    if (!verificationUrl) {
      throw new errors.ValidationError("Email verification URL is not configured");
    }

    // Validate URL security in production
    if (process.env.NODE_ENV === "production" && !verificationUrl.startsWith("https://")) {
      throw new errors.ValidationError("Email verification URL must use HTTPS in production");
    }

    // Validate URL format
    try {
      new URL(verificationUrl);
    } catch (error) {
      throw new errors.ValidationError("Email verification URL is not a valid URL format");
    }

    try {
      // Try to find user in Firebase
      let firebaseUser;
      try {
        firebaseUser = await strapi.firebase.auth().getUserByEmail(email);
      } catch (fbError) {
        strapi.log.debug("User not found in Firebase");
      }

      if (!firebaseUser) {
        strapi.log.warn(`⚠️ [sendVerificationEmail] User not found in Firebase for email: ${email}`);
        // Security: Don't reveal if email exists or not
        return { message: "If an account with that email exists, a verification link has been sent." };
      }

      // Check if already verified
      if (firebaseUser.emailVerified) {
        strapi.log.info(`[sendVerificationEmail] User ${email} is already verified`);
        return { message: "Email is already verified." };
      }

      // Get the firebase-user-data record
      const firebaseData = await strapi
        .plugin("firebase-authentication")
        .service("firebaseUserDataService")
        .getByFirebaseUID(firebaseUser.uid);

      if (!firebaseData) {
        strapi.log.warn(`⚠️ [sendVerificationEmail] No firebase-user-data record for: ${email}`);
        // Security: Don't reveal if email exists or not
        return { message: "If an account with that email exists, a verification link has been sent." };
      }

      strapi.log.info(
        `✅ [sendVerificationEmail] User found: ${JSON.stringify({
          firebaseUID: firebaseUser.uid,
          email: firebaseUser.email,
          emailVerified: firebaseUser.emailVerified,
        })}`
      );

      // Generate custom JWT token using tokenService (with email for change detection)
      const tokenService = strapi.plugin("firebase-authentication").service("tokenService");
      const token = await tokenService.generateVerificationToken(firebaseData.documentId, email);

      // Build the verification link using admin-configured URL + our token
      let verificationLink = `${verificationUrl}?token=${token}`;

      // If credentials should be included, generate Firebase custom token
      if (config?.includeCredentialsInVerificationLink) {
        try {
          const customToken = await strapi.firebase.auth().createCustomToken(firebaseUser.uid);
          verificationLink = `${verificationLink}&fjwt=${customToken}`;
          strapi.log.info(`[sendVerificationEmail] Added Firebase custom token to verification link`);
        } catch (tokenError: any) {
          strapi.log.warn(`[sendVerificationEmail] Could not generate custom token: ${tokenError.message}`);
          // Continue with link without token
        }
      }

      strapi.log.info(`✅ [sendVerificationEmail] Verification link generated for ${email}`);

      // Send email using our three-tier fallback system
      strapi.log.info(`[sendVerificationEmail] Attempting to send verification email to: ${email}`);
      await strapi
        .plugin("firebase-authentication")
        .service("emailService")
        .sendVerificationEmail(firebaseUser, verificationLink);

      strapi.log.info(`✅ [sendVerificationEmail] Verification email sent successfully to: ${email}`);

      // Security: Always return same message
      return {
        message: "If an account with that email exists, a verification link has been sent.",
      };
    } catch (error) {
      strapi.log.error(
        `❌ [sendVerificationEmail] ERROR: ${JSON.stringify({
          email,
          message: error.message,
          code: error.code,
          name: error.name,
          stack: error.stack,
        })}`
      );
      // Security: Don't reveal internal errors
      return {
        message: "If an account with that email exists, a verification link has been sent.",
      };
    }
  },

  /**
   * Verify email with token - public endpoint
   * Validates the token and marks the user's email as verified in Firebase
   */
  async verifyEmail(token: string) {
    strapi.log.info(`[verifyEmail] Starting email verification with token`);

    if (!token) {
      throw new errors.ValidationError("Verification token is required");
    }

    // Validate token using tokenService
    const tokenService = strapi.plugin("firebase-authentication").service("tokenService");
    const validationResult = await tokenService.validateVerificationToken(token);

    if (!validationResult.valid) {
      // Special case: token was already used, but check if email is actually verified
      if (validationResult.code === "TOKEN_ALREADY_USED" && validationResult.firebaseUID) {
        try {
          const firebaseUser = await strapi.firebase.auth().getUser(validationResult.firebaseUID);
          if (firebaseUser.emailVerified) {
            strapi.log.info(
              `[verifyEmail] Token already used but email is verified for: ${firebaseUser.email}`
            );
            return {
              success: true,
              message: "This email has already been verified.",
              uid: validationResult.firebaseUID,
            };
          }
        } catch (checkError) {
          strapi.log.warn(`[verifyEmail] Could not verify Firebase user status: ${checkError.message}`);
        }
      }

      strapi.log.warn(`[verifyEmail] Token validation failed: ${validationResult.error}`);
      throw new errors.ValidationError(validationResult.error || "Invalid verification link");
    }

    const { firebaseUID, firebaseUserDataDocumentId, email: tokenEmail } = validationResult;

    try {
      // Get current Firebase user to check if email has changed
      const firebaseUser = await strapi.firebase.auth().getUser(firebaseUID);

      // Check if email has changed since token was issued
      if (tokenEmail && firebaseUser.email !== tokenEmail) {
        strapi.log.warn(
          `[verifyEmail] Email changed: token email ${tokenEmail} != current email ${firebaseUser.email}`
        );
        // Invalidate the token since email changed
        await tokenService.invalidateVerificationToken(firebaseUserDataDocumentId);
        throw new errors.ValidationError(
          "Email address has changed since verification was requested. Please request a new verification link."
        );
      }

      // Check if already verified
      if (firebaseUser.emailVerified) {
        strapi.log.info(`[verifyEmail] User ${firebaseUser.email} is already verified`);
        // Still invalidate the token to prevent reuse
        await tokenService.invalidateVerificationToken(firebaseUserDataDocumentId);
        return {
          success: true,
          message: "Email is already verified.",
          uid: firebaseUID,
        };
      }

      // Mark email as verified in Firebase
      await strapi.firebase.auth().updateUser(firebaseUID, {
        emailVerified: true,
      });

      // Also update Strapi user's confirmed status (non-blocking)
      try {
        const firebaseUserDataService = strapi
          .plugin("firebase-authentication")
          .service("firebaseUserDataService");
        const firebaseUserData = await firebaseUserDataService.getByFirebaseUID(firebaseUID);

        if (firebaseUserData?.user?.documentId) {
          await strapi.db.query("plugin::users-permissions.user").update({
            where: { documentId: firebaseUserData.user.documentId },
            data: { confirmed: true },
          });
          strapi.log.info(`✅ [verifyEmail] Strapi user confirmed for: ${firebaseUserData.user.documentId}`);
        }
      } catch (strapiUpdateError) {
        // Log but don't fail - Firebase verification succeeded, that's what matters
        strapi.log.warn(
          `[verifyEmail] Failed to update Strapi user confirmed status: ${strapiUpdateError.message}`
        );
      }

      strapi.log.info(`✅ [verifyEmail] Email verified successfully for: ${firebaseUser.email}`);

      // Invalidate token (one-time use)
      await tokenService.invalidateVerificationToken(firebaseUserDataDocumentId);

      return {
        success: true,
        message: "Email verified successfully.",
        uid: firebaseUID,
      };
    } catch (error) {
      strapi.log.error(
        `❌ [verifyEmail] ERROR: ${JSON.stringify({
          firebaseUID,
          message: error.message,
          code: error.code,
          name: error.name,
        })}`
      );

      if (error instanceof errors.ValidationError) {
        throw error;
      }

      throw new errors.ApplicationError("Failed to verify email. Please try again.");
    }
  },

  /**
   * Check if a password is valid for the authenticated user
   * Uses Firebase Identity Toolkit API to verify the password
   *
   * @param user - Authenticated user from ctx.state.user
   * @param password - Password to check
   * @returns { valid: true } or { valid: false }
   */
  async checkPassword(user: any, password: string) {
    if (!user || !user.email) {
      throw new errors.ValidationError("User email is required");
    }

    // Get Firebase UID for activity logging
    let firebaseUID: string | null = null;
    try {
      const firebaseData = await strapi
        .documents("plugin::firebase-authentication.firebase-user-data")
        .findFirst({
          filters: { user: { documentId: { $eq: user.documentId } } },
          fields: ["firebaseUserID"],
        });
      firebaseUID = firebaseData?.firebaseUserID || null;
    } catch (err) {
      strapi.log.warn("[checkPassword] Failed to get Firebase UID for logging:", err);
    }

    // Get Firebase Web API key from settings
    const config = await strapi
      .plugin("firebase-authentication")
      .service("settingsService")
      .getFirebaseConfigJson();

    if (!config || !config.firebaseWebApiKey) {
      throw new errors.ValidationError(
        "Password verification is not available. Web API Key is not configured.\n\n" +
          "To enable password verification:\n" +
          "1. Go to Firebase Console > Project Settings > General\n" +
          "2. Copy your Web API Key\n" +
          "3. Add it in Strapi Admin > Settings > Firebase Authentication > Optional Settings"
      );
    }

    try {
      // Call Firebase Identity Toolkit API to verify password
      const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${config.firebaseWebApiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: user.email,
            password,
            returnSecureToken: false,
          }),
        }
      );

      const data: any = await response.json();

      if (!response.ok) {
        const errorMessage = data.error?.message || "Authentication failed";
        strapi.log.debug(`checkPassword: password invalid for user ${user.email}: ${errorMessage}`);

        // Password is invalid
        if (
          errorMessage === "INVALID_PASSWORD" ||
          errorMessage === "INVALID_LOGIN_CREDENTIALS" ||
          errorMessage.includes("INVALID")
        ) {
          return { valid: false, uid: firebaseUID };
        }

        // Other errors (user disabled, etc.) - still return valid: false for security
        return { valid: false, uid: firebaseUID };
      }

      // Password is valid
      return { valid: true, uid: firebaseUID };
    } catch (error) {
      strapi.log.error("checkPassword error:", error);
      throw new errors.ApplicationError("Failed to verify password");
    }
  },
});

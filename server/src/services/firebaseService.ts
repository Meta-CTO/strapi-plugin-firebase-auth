import { errors } from "@strapi/utils";
import { processMeData } from "../utils/fetch-me";
import { generateReferralCode } from "../utils";
import { promiseHandler } from "../utils/promiseHandler";

// Default email pattern - matches the default in server/config/index.ts
const DEFAULT_EMAIL_PATTERN = "{randomString}@phone-user.firebase.local";

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
      return firebaseData.user; // Already populated by service
    }

    // Fallback 1: Email lookup (for users not yet migrated or created before plugin)
    if (decodedToken.email) {
      const userByEmail = await strapi.db.query("plugin::users-permissions.user").findOne({
        where: { email: decodedToken.email },
        populate: ["role"],
      });

      if (userByEmail) {
        // User exists but no firebase_user_data record - auto-link it
        try {
          await strapi
            .plugin("firebase-authentication")
            .service("firebaseUserDataService")
            .updateForUser(userByEmail.documentId, {
              firebaseUserID: firebaseUID,
            });
          strapi.log.info(`Auto-linked user ${userByEmail.username} to Firebase UID ${firebaseUID}`);
        } catch (error) {
          // Ignore duplicate key errors (another request already linked this user)
          if (error.code !== "23505") {
            // PostgreSQL unique constraint violation
            throw error;
          }
          strapi.log.info(`User ${userByEmail.username} already linked to Firebase (race condition handled)`);
        }

        return userByEmail;
      }

      // Check appleEmail fallback (for Apple Sign-In users)
      const userByAppleEmail = await strapi.db.query("plugin::users-permissions.user").findOne({
        where: { appleEmail: decodedToken.email },
        populate: ["role"],
      });

      if (userByAppleEmail) {
        // User exists but no firebase_user_data record - auto-link it
        try {
          await strapi
            .plugin("firebase-authentication")
            .service("firebaseUserDataService")
            .updateForUser(userByAppleEmail.documentId, {
              firebaseUserID: firebaseUID,
            });
          strapi.log.info(
            `Auto-linked Apple user ${userByAppleEmail.username} to Firebase UID ${firebaseUID}`
          );
        } catch (error) {
          // Ignore duplicate key errors (another request already linked this user)
          if (error.code !== "23505") {
            // PostgreSQL unique constraint violation
            throw error;
          }
          strapi.log.info(
            `User ${userByAppleEmail.username} already linked to Firebase (race condition handled)`
          );
        }

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
        // User exists but no firebase_user_data record - auto-link it
        try {
          await strapi
            .plugin("firebase-authentication")
            .service("firebaseUserDataService")
            .updateForUser(userByPhone.documentId, {
              firebaseUserID: firebaseUID,
            });
          strapi.log.info(`Auto-linked phone user ${userByPhone.username} to Firebase UID ${firebaseUID}`);
        } catch (error) {
          // Ignore duplicate key errors (another request already linked this user)
          if (error.code !== "23505") {
            // PostgreSQL unique constraint violation
            throw error;
          }
          strapi.log.info(`User ${userByPhone.username} already linked to Firebase (race condition handled)`);
        }

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
    let newUser;
    try {
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

      userPayload.email = decodedToken.email;
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
          // Use email from profileMetaData if provided
          userPayload.email = profileMetaData.email;
        } else if (emailRequired) {
          // Generate fake email using configured pattern
          userPayload.email = await createFakeEmail(userPayload.phoneNumber, emailPattern);
        } else {
          // Allow null email
          userPayload.email = null;
        }
      }

      // Step 1: Create Strapi user (no Firebase-specific fields)
      newUser = await strapi.db.query("plugin::users-permissions.user").create({ data: userPayload });

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
    } catch (error) {
      // Cleanup: Delete user if firebase_user_data creation failed
      if (newUser) {
        try {
          await strapi.db.query("plugin::users-permissions.user").delete({
            where: { documentId: newUser.documentId },
          });
          strapi.log.warn(
            `Cleaned up orphaned user ${newUser.documentId} after firebase_user_data creation failed`
          );
        } catch (cleanupError) {
          strapi.log.error("Failed to cleanup orphaned user", cleanupError);
        }
      }
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
      throw new errors.ApplicationError(
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
   * Forgot password flow - sends reset email
   * Public endpoint that generates a JWT token and sends a password reset email
   */
  forgotPassword: async (ctx) => {
    const { email } = ctx.request.body;

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
      throw new errors.ApplicationError("Password reset URL is not configured");
    }

    // Validate URL security in production
    if (process.env.NODE_ENV === "production" && !resetUrl.startsWith("https://")) {
      throw new errors.ApplicationError("Password reset URL must use HTTPS in production");
    }

    // Validate URL format
    try {
      new URL(resetUrl);
    } catch (error) {
      throw new errors.ApplicationError("Password reset URL is not a valid URL format");
    }

    try {
      // Priority 1: Try to find user in Firebase
      let firebaseUser;
      try {
        firebaseUser = await strapi.firebase.auth().getUserByEmail(email);
      } catch (fbError) {
        // Firebase user not found, that's okay
        strapi.log.debug("User not found in Firebase, checking Strapi...");
      }

      // Priority 2: Find in Strapi if not in Firebase
      let strapiUser;
      if (firebaseUser) {
        // Found in Firebase, now find corresponding Strapi user via firebase_user_data
        const firebaseData = await strapi
          .plugin("firebase-authentication")
          .service("firebaseUserDataService")
          .getByFirebaseUID(firebaseUser.uid);

        if (firebaseData) {
          strapiUser = firebaseData.user;
        }

        // Fallback: try by email
        if (!strapiUser) {
          strapiUser = await strapi.db.query("plugin::users-permissions.user").findOne({
            where: { email: email },
          });
        }
      } else {
        // Not in Firebase, check Strapi only
        strapiUser = await strapi.db.query("plugin::users-permissions.user").findOne({
          where: { email: email },
        });
      }

      if (!strapiUser) {
        // Security: Don't reveal if email exists or not
        return { message: "If an account with that email exists, a password reset link has been sent." };
      }

      // Generate 1-hour JWT using numeric id for auth middleware compatibility
      const jwtService = strapi.plugin("users-permissions").service("jwt");
      const token = jwtService.issue(
        { id: strapiUser.id }, // Use numeric id, not documentId
        { expiresIn: "1h" }
      );

      // Build reset link
      const resetLink = `${resetUrl}?token=${token}`;

      // Send email using our three-tier fallback system
      await strapi
        .plugin("firebase-authentication")
        .service("emailService")
        .sendPasswordResetEmail(strapiUser, resetLink);

      // Security: Always return same message
      return {
        message: "If an account with that email exists, a password reset link has been sent.",
      };
    } catch (error) {
      strapi.log.error("forgotPassword error:", error);
      // Security: Don't reveal internal errors
      return {
        message: "If an account with that email exists, a password reset link has been sent.",
      };
    }
  },

  /**
   * Reset password with authenticated JWT
   * Public endpoint that validates a JWT token and resets the user's password
   */
  resetPassword: async (ctx) => {
    const { password } = ctx.request.body;
    const populate = ctx.request.query.populate || [];

    if (!password) {
      throw new errors.ValidationError("Password is required");
    }

    // Verify JWT from Authorization header
    const token = ctx.request.header.authorization?.replace("Bearer ", "");
    if (!token) {
      throw new errors.UnauthorizedError("Authorization token is required");
    }

    let decoded;
    try {
      const jwtService = strapi.plugin("users-permissions").service("jwt");
      decoded = await jwtService.verify(token);
    } catch (error) {
      throw new errors.UnauthorizedError("Invalid or expired token");
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
      // Get Strapi user using Query Engine API with numeric id from JWT
      const strapiUser = await strapi.db.query("plugin::users-permissions.user").findOne({
        where: { id: decoded.id }, // Use numeric id from JWT
      });

      if (!strapiUser) {
        throw new errors.NotFoundError("User not found");
      }

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

      // Generate fresh JWT for auto-login using numeric id
      const jwtService = strapi.plugin("users-permissions").service("jwt");
      const jwt = jwtService.issue({
        id: strapiUser.id, // Use numeric id for consistency
      });

      // Return user + JWT (same format as validateFirebaseToken)
      return {
        user: await processMeData(strapiUser, populate),
        jwt,
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
  async requestMagicLink(ctx) {
    const { email } = ctx.request.body;

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
      throw new errors.ApplicationError(
        "Magic link authentication is not enabled. " + "Enable it in Settings > Firebase Authentication"
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
        strapi.log.info("🔗 Magic Link Generation Request:");
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
        throw new errors.ApplicationError(
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
});

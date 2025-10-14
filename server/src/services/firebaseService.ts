import { errors } from "@strapi/utils";
import { processMeData } from "../utils/fetch-me";
import { generateReferralCode } from "../utils";
import { promiseHandler } from "../utils/promiseHandler";

// Default email pattern - matches the default in server/config/index.ts
const DEFAULT_EMAIL_PATTERN = '{randomString}@phone-user.firebase.local';

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
    const phoneDigits = phoneNumber ? phoneNumber.replace(/[^0-9]/g, '') : '';

    let fakeEmail = emailPattern
      .replace('{randomString}', randomString)
      .replace('{timestamp}', timestamp)
      .replace('{phoneNumber}', phoneDigits);

    const existingUser = await strapi.db
      .query("plugin::users-permissions.user")
      .findOne({
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
    `Phone number: "${phoneNumber || 'N/A'}"\n\n` +
    `This usually means your emailPattern doesn't include enough uniqueness.\n` +
    `Make sure your pattern includes {randomString} or {timestamp} tokens.\n\n` +
    `Valid pattern examples:\n` +
    `  - "phone_{phoneNumber}_{randomString}@myapp.local"\n` +
    `  - "user_{timestamp}@temp.local"\n` +
    `  - "{randomString}@phone-user.firebase.local"`
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
  const phoneDigits = phoneNumber.replace(/[^0-9]/g, '');

  // Truncate to 20 characters if needed (username max length)
  let username = phoneDigits.substring(0, 20);

  // Ensure minimum length of 5 characters
  if (username.length < 5) {
    // Pad with random digits if phone number is too short
    const randomDigits = Math.random().toString().substring(2, 7 - username.length);
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
    return strapi.plugins["users-permissions"].contentTypes["user"].attributes;
  },
  delete: async (entityId) => {
    await strapi.firebase.auth().deleteUser(entityId);
    return { success: true };
  },

  validateExchangeTokenPayload: async (requestPayload) => {
    const { idToken } = requestPayload;
    console.log("Validating idToken:", idToken?.substring(0, 20) + "...");

    if (!idToken || idToken.length === 0) {
      throw new errors.ValidationError("idToken is missing!");
    }

    try {
      try {
        const decodedToken = await strapi.firebase.auth().verifyIdToken(idToken);
        if (!decodedToken) {
          throw new Error("Token verification returned null");
        }
        return decodedToken;
      } catch (error) {
        console.error("Firebase token verification failed:", {
          error: error.message,
          stack: error.stack,
        });
        throw new errors.UnauthorizedError(`Firebase authentication failed: ${error.message}`);
      }
    } catch (error) {
      console.error("Firebase token verification failed:", {
        error: error.message,
        stack: error.stack,
      });

      // Throw a more specific error
      throw new errors.UnauthorizedError(`Firebase authentication failed: ${error.message}`);
    }
  },

  decodeIDToken: async (idToken) => {
    return await strapi.firebase.auth().verifyIdToken(idToken);
  },

  overrideFirebaseAccess: async (ctx) => {
    if (!ctx.request.body || !ctx.request.body.overrideUserId) {
      return ctx.badRequest(null, [{ messages: [{ id: "unauthorized" }] }]);
    }

    const overrideUserId = ctx.request.body.overrideUserId;

    const user = await strapi.plugins["users-permissions"].services.user.fetch(overrideUserId);

    const jwt = await strapi.plugins["users-permissions"].services.jwt.issue({
      id: user.id,
    });

    ctx.body = {
      user: await processMeData(user),
      jwt,
    };

    return ctx.body;
  },

  async checkIfUserExists(decodedToken) {
    const userModel = await this.getUserAttributes();

    let query: any = {};
    let dbUser = null;

    // First Check if the user exists in the database with firebaseUserID
    if (userModel.hasOwnProperty("firebaseUserID") && (decodedToken.user_id || decodedToken.uid)) {
      const firebaseUserID = decodedToken.user_id || decodedToken.uid;
      dbUser = await strapi.db.query("plugin::users-permissions.user").findOne({
        where: {
          firebaseUserID,
        },
      });
      if (dbUser) {
        return dbUser;
      }
    }

    query.$or = [];

    // Check if email is available and construct query
    if (decodedToken.email) {
      query.$or.push({ email: decodedToken.email });
      // Extend the query with appleEmail if that attribute exists in the userModel
      if (userModel.hasOwnProperty("appleEmail")) {
        query.$or.push({ appleEmail: decodedToken.email });
      }
    }

    // Add phone number to query if available
    if (decodedToken.phone_number) {
      query.$or.push({ phoneNumber: decodedToken.phone_number });
    }

    // Execute a single database query with constructed conditions
    dbUser = await strapi.db.query("plugin::users-permissions.user").findOne({
      where: query,
    });

    // Return user or null if not found
    return dbUser;
  },

  fetchUser: async (decodedToken) => {
    const { data: user, error } = await promiseHandler(
      strapi.db.query("plugin::users-permissions.user").findOne({
        where: {
          firebaseUserID: decodedToken.uid,
        },
      })
    );

    if (error) {
      throw new errors.ValidationError(error?.message || "User not found", error);
    }

    return user;
  },

  generateJWTForCurrentUser: async (user) => {
    return strapi.plugins["users-permissions"].services.jwt.issue({
      id: user.id,
    });
  },

  async createStrapiUser(decodedToken, idToken, profileMetaData) {
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
    userPayload.firebaseUserID = decodedToken.uid;
    userPayload.confirmed = true;

    userPayload.email = decodedToken.email;
    userPayload.phoneNumber = decodedToken.phone_number;
    userPayload.idToken = idToken;
    if (profileMetaData) {
      userPayload.firstName = profileMetaData?.firstName;
      userPayload.lastName = profileMetaData?.lastName;
      userPayload.phoneNumber = profileMetaData?.phoneNumber;
    }

    if (decodedToken.email) {
      const emailComponents = decodedToken.email.split("@");
      userPayload.username = emailComponents[0];
      if (emailComponents[1].includes("privaterelay.appleid.com")) {
        userPayload.appleEmail = decodedToken.email;
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

    return strapi.query("plugin::users-permissions.user").create({ data: userPayload });
  },

  updateUserIDToken: async (user, idToken, decodedToken) => {
    return strapi.db.query("plugin::users-permissions.user").update({
      where: {
        id: user.id,
      },
      data: { idToken, firebaseUserID: decodedToken.uid },
    });
  },

  validateFirebaseToken: async (ctx) => {
    console.log("validateFirebaseToken 🤣");
    const { profileMetaData } = ctx.request.body;
    const { error } = await promiseHandler(
      strapi
        .plugin("firebase-authentication")
        .service("firebaseService")
        .validateExchangeTokenPayload(ctx.request.body)
    );
    if (error) {
      ctx.status = 400;
      return { error: error.message };
    }

    const { idToken } = ctx.request.body;
    const populate = ctx.request.query.populate || [];

    const decodedToken = await strapi
      .plugin("firebase-authentication")
      .service("firebaseService")
      .decodeIDToken(idToken);

    let user;

    user = await strapi
      .plugin("firebase-authentication")
      .service("firebaseService")
      .checkIfUserExists(decodedToken, profileMetaData);

    let jwt;

    if (!user) {
      // create strapi user
      user = await strapi
        .plugin("firebase-authentication")
        .service("firebaseService")
        .createStrapiUser(decodedToken, idToken, profileMetaData);
    }

    jwt = await strapi
      .plugin("firebase-authentication")
      .service("firebaseService")
      .generateJWTForCurrentUser(user);

    strapi
      .plugin("firebase-authentication")
      .service("firebaseService")
      .updateUserIDToken(user, idToken, decodedToken);

    return {
      user: await processMeData(user, populate),
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
  emailLogin: async (ctx) => {
    console.log("emailLogin endpoint called");
    const { email, password } = ctx.request.body;

    if (!email || !password) {
      throw new errors.ValidationError("Email and password are required");
    }

    // Get Firebase Web API key from settings
    const config = await strapi
      .plugin("firebase-authentication")
      .service("settingsService")
      .getFirebaseConfigJson();

    if (!config || !config.firebaseWebApiKey) {
      throw new errors.ApplicationError("Firebase Web API key is not configured");
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
        console.error("Firebase authentication error:", errorMessage);

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
      const populate = ctx.request.query.populate || [];

      // Decode the token to get user details
      const decodedToken = await strapi
        .plugin("firebase-authentication")
        .service("firebaseService")
        .decodeIDToken(idToken);

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

      // Update user's idToken
      strapi
        .plugin("firebase-authentication")
        .service("firebaseService")
        .updateUserIDToken(user, idToken, decodedToken);

      // Return same format as validateFirebaseToken
      return {
        user: await processMeData(user, populate),
        jwt,
      };
    } catch (error) {
      console.error("emailLogin error:", error);
      if (error instanceof errors.ValidationError || error instanceof errors.ApplicationError) {
        throw error;
      }
      throw new errors.ApplicationError("Authentication failed");
    }
  },
});

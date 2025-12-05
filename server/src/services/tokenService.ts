import { errors } from "@strapi/utils";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { PLUGIN_UID, ERROR_MESSAGES, TIME_CONSTANTS, CONFIG_KEYS } from "../constants";

const { ValidationError, ApplicationError, NotFoundError } = errors;

// Content type for firebase user data
const FIREBASE_USER_DATA_CONTENT_TYPE = `${PLUGIN_UID}.firebase-user-data`;

interface ResetTokenPayload {
  sub: string; // User document ID (firebase-user-data)
  purpose: "password-reset";
  jti: string; // Unique token ID
  iat: number;
  exp: number;
}

export interface TokenValidationResult {
  valid: boolean;
  firebaseUserDataDocumentId: string;
  firebaseUID: string;
  error?: string;
}

export default ({ strapi }) => {
  // Get the encryption key from plugin config (reuse existing key)
  const getSigningKey = (): string => {
    const encryptionKey = strapi.config.get(CONFIG_KEYS.ENCRYPTION_KEY);
    if (!encryptionKey) {
      throw new ApplicationError(
        "FIREBASE_JSON_ENCRYPTION_KEY is not configured. Cannot generate secure tokens."
      );
    }
    return encryptionKey;
  };

  return {
    /**
     * Generate a password reset token for a user
     * @param firebaseUserDataDocumentId - The documentId of the firebase-user-data record
     * @returns The JWT token to include in the reset URL
     */
    async generateResetToken(firebaseUserDataDocumentId: string): Promise<string> {
      const signingKey = getSigningKey();

      // Generate a unique token ID (jti)
      const jti = crypto.randomBytes(32).toString("hex");

      // Create JWT payload
      const payload: Omit<ResetTokenPayload, "iat" | "exp"> = {
        sub: firebaseUserDataDocumentId,
        purpose: "password-reset",
        jti,
      };

      // Sign the token with 1 hour expiration
      const token = jwt.sign(payload, signingKey, {
        expiresIn: "1h",
      });

      // Store hash of jti in database (not the full token)
      const tokenHash = crypto.createHash("sha256").update(jti).digest("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

      // Update the firebase-user-data record with token hash
      await strapi.db.query(FIREBASE_USER_DATA_CONTENT_TYPE).update({
        where: { documentId: firebaseUserDataDocumentId },
        data: {
          resetTokenHash: tokenHash,
          resetTokenExpiresAt: expiresAt.toISOString(),
        },
      });

      strapi.log.debug(`Generated reset token for user ${firebaseUserDataDocumentId}`);

      return token;
    },

    /**
     * Validate a password reset token
     * @param token - The JWT token from the reset URL
     * @returns Validation result with user info if valid
     */
    async validateResetToken(token: string): Promise<TokenValidationResult> {
      const signingKey = getSigningKey();

      try {
        // Verify JWT signature and expiration
        const decoded = jwt.verify(token, signingKey) as ResetTokenPayload;

        // Check purpose claim
        if (decoded.purpose !== "password-reset") {
          return {
            valid: false,
            firebaseUserDataDocumentId: "",
            firebaseUID: "",
            error: "Invalid token purpose",
          };
        }

        // Hash the jti to compare with stored hash
        const tokenHash = crypto.createHash("sha256").update(decoded.jti).digest("hex");

        // Find the user and verify token hash
        const firebaseUserData = await strapi.db.query(FIREBASE_USER_DATA_CONTENT_TYPE).findOne({
          where: { documentId: decoded.sub },
        });

        if (!firebaseUserData) {
          return {
            valid: false,
            firebaseUserDataDocumentId: "",
            firebaseUID: "",
            error: "User not found",
          };
        }

        // Check if token hash matches
        if (firebaseUserData.resetTokenHash !== tokenHash) {
          return {
            valid: false,
            firebaseUserDataDocumentId: "",
            firebaseUID: "",
            error: "Token has already been used or is invalid",
          };
        }

        // Check if token hasn't expired in database (belt and suspenders)
        if (firebaseUserData.resetTokenExpiresAt) {
          const expiresAt = new Date(firebaseUserData.resetTokenExpiresAt);
          if (expiresAt < new Date()) {
            return {
              valid: false,
              firebaseUserDataDocumentId: "",
              firebaseUID: "",
              error: "Token has expired",
            };
          }
        }

        return {
          valid: true,
          firebaseUserDataDocumentId: firebaseUserData.documentId,
          firebaseUID: firebaseUserData.firebaseUserID,
        };
      } catch (error: any) {
        if (error.name === "TokenExpiredError") {
          return {
            valid: false,
            firebaseUserDataDocumentId: "",
            firebaseUID: "",
            error: "Token has expired",
          };
        }
        if (error.name === "JsonWebTokenError") {
          return {
            valid: false,
            firebaseUserDataDocumentId: "",
            firebaseUID: "",
            error: "Invalid token",
          };
        }
        throw error;
      }
    },

    /**
     * Invalidate a reset token after use
     * @param firebaseUserDataDocumentId - The documentId of the firebase-user-data record
     */
    async invalidateResetToken(firebaseUserDataDocumentId: string): Promise<void> {
      await strapi.db.query(FIREBASE_USER_DATA_CONTENT_TYPE).update({
        where: { documentId: firebaseUserDataDocumentId },
        data: {
          resetTokenHash: null,
          resetTokenExpiresAt: null,
        },
      });

      strapi.log.debug(`Invalidated reset token for user ${firebaseUserDataDocumentId}`);
    },
  };
};

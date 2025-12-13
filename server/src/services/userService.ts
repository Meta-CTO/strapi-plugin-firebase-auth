import { errors } from "@strapi/utils";

import paginate from "../utils/paginate";

export default ({ strapi }) => {
  // Helper function to check if Firebase is initialized
  const ensureFirebaseInitialized = () => {
    if (!strapi.firebase) {
      throw new errors.ApplicationError(
        "Firebase is not initialized. Please upload Firebase service account configuration via Settings → Firebase Authentication."
      );
    }
  };

  return {
    get: async (entityId: string) => {
      try {
        ensureFirebaseInitialized();
        const user = await strapi.firebase.auth().getUser(entityId);
        const firebaseUser = user.toJSON();

        return firebaseUser;
      } catch (e) {
        throw new errors.ApplicationError(e.message.toString());
      }
    },

    create: async (payload) => {
      try {
        ensureFirebaseInitialized();

        // Support lookup by email OR phone number
        let getUserPromise;
        if (payload.email) {
          getUserPromise = strapi.firebase.auth().getUserByEmail(payload.email);
        } else if (payload.phoneNumber) {
          getUserPromise = strapi.firebase.auth().getUserByPhoneNumber(payload.phoneNumber);
        } else {
          throw new errors.ApplicationError("Either email or phoneNumber is required");
        }

        const userRecord = await getUserPromise.catch(async (e) => {
          if (e.code === "auth/user-not-found") {
            strapi.log.debug("user not found, creating user");
            const response = await strapi.firebase.auth().createUser(payload);

            return response.toJSON();
          }
          throw e;
        });

        if (userRecord) {
          return userRecord;
        }
      } catch (e) {
        throw new errors.ApplicationError(e.message.toString());
      }
    },

    register: async (userID, payload) => {
      try {
        ensureFirebaseInitialized();
        const res = await strapi.plugin("firebase-authentication").service("userService").create(payload);
        const actionCodeSettings = {
          url: process.env.BASE_URL,
        };
        const link = await strapi.firebase
          .auth()
          .generatePasswordResetLink(payload.email, actionCodeSettings);
        await strapi.plugin("users-permissions").service("user").edit(userID, {
          firebaseUserID: res.uid,
          passwordResetLink: link,
        });
      } catch (e) {
        throw new errors.ApplicationError(e.message.toString());
      }
    },

    list: async (pagination, nextPageToken, sort, searchQuery) => {
      ensureFirebaseInitialized();

      // If search query exists, try exact match lookups first
      if (searchQuery) {
        try {
          let foundUser = null;

          // Trim whitespace and normalize the search query
          searchQuery = searchQuery.trim();

          // Try exact phone lookup first (if it starts with + or looks like a phone)
          if (searchQuery.startsWith("+") || searchQuery.match(/^\d{10,15}$/)) {
            // Ensure phone has + prefix for Firebase lookup
            const phoneWithPlus = searchQuery.startsWith("+") ? searchQuery : `+${searchQuery}`;
            try {
              foundUser = await strapi.firebase.auth().getUserByPhoneNumber(phoneWithPlus);
            } catch (e) {
              // Not a valid phone, continue
            }
          }

          // Try exact email lookup
          if (!foundUser && searchQuery.includes("@")) {
            try {
              foundUser = await strapi.firebase.auth().getUserByEmail(searchQuery);
            } catch (e) {
              // Not a valid email, continue
            }
          }

          // Try exact UID lookup (Firebase UIDs are alphanumeric strings)
          if (!foundUser && searchQuery.length >= 20) {
            try {
              foundUser = await strapi.firebase.auth().getUser(searchQuery);
            } catch (e) {
              // Not a valid UID, continue
            }
          }

          // Try Strapi ID lookup (short numbers only, to avoid confusion with phone)
          if (!foundUser && searchQuery.match(/^\d{1,6}$/)) {
            try {
              const strapiUser = await strapi.db
                .query("plugin::users-permissions.user")
                .findOne({ where: { id: parseInt(searchQuery) } });

              if (strapiUser) {
                // Try to get Firebase UID from firebase_user_data table
                const firebaseData = await strapi
                  .plugin("firebase-authentication")
                  .service("firebaseUserDataService")
                  .findOrCreateForUser(strapiUser.documentId)
                  .catch(() => null);

                if (firebaseData?.firebaseUserID) {
                  foundUser = await strapi.firebase.auth().getUser(firebaseData.firebaseUserID);
                } else {
                  // Fallback: Try to find Firebase user by email or phone from Strapi data
                  if (strapiUser.email) {
                    try {
                      foundUser = await strapi.firebase.auth().getUserByEmail(strapiUser.email);
                    } catch (e) {
                      // Email lookup failed, continue
                    }
                  }

                  if (!foundUser && strapiUser.phoneNumber) {
                    try {
                      foundUser = await strapi.firebase.auth().getUserByPhoneNumber(strapiUser.phoneNumber);
                    } catch (e) {
                      // Phone lookup failed, continue
                    }
                  }
                }
              }
            } catch (e) {
              // Not a valid Strapi ID, continue
            }
          }

          // If we found an exact match, return it immediately
          if (foundUser) {
            const totalUserscount = await strapi.firebase.auth().listUsers();

            // Get link service and build user map
            const linkService = strapi.plugin("firebase-authentication").service("firebaseStrapiLinkService");
            const uidToUserMap = await linkService.buildUserMap();

            const strapiUsers = await strapi.db.query("plugin::users-permissions.user").findMany();

            // Link Firebase user with Strapi data
            const linkedUsers = linkService.linkFirebaseUsers([foundUser], uidToUserMap, strapiUsers);

            const { meta } = paginate(
              linkedUsers,
              1, // Only 1 result for exact match
              pagination
            );

            return { data: linkedUsers, pageToken: undefined, meta };
          }
        } catch (e) {
          // If exact match fails, fall through to normal pagination
        }
      }

      // When sorting OR searching, fetch ALL users to sort/filter the complete dataset
      let allFirebaseUsers;
      if (sort || searchQuery) {
        // Fetch ALL users by following pagination tokens
        let allUsers = [];
        let pageToken = undefined;
        do {
          const result = await strapi.firebase.auth().listUsers(1000, pageToken);
          allUsers.push(...result.users);
          pageToken = result.pageToken;
        } while (pageToken);

        allFirebaseUsers = { users: allUsers };
      } else {
        // Normal pagination - fetch only the requested page
        allFirebaseUsers = await strapi.firebase
          .auth()
          .listUsers(parseInt(pagination.pageSize), nextPageToken);
      }

      const totalUserscount = await strapi.firebase.auth().listUsers();

      // Get link service and build user map
      const linkService = strapi.plugin("firebase-authentication").service("firebaseStrapiLinkService");
      const uidToUserMap = await linkService.buildUserMap();

      const strapiUsers = await strapi.db.query("plugin::users-permissions.user").findMany();

      // Link Firebase users with Strapi data
      const linkedUsers = linkService.linkFirebaseUsers(allFirebaseUsers.users, uidToUserMap, strapiUsers);

      const allUsers = { users: linkedUsers };

      let sortedUsers = allUsers.users;
      let paginatedData = sortedUsers;

      // Apply search filter if provided (partial matching across all fields)
      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase();
        sortedUsers = sortedUsers.filter((user) => {
          return (
            user.uid?.toLowerCase().includes(searchLower) ||
            user.email?.toLowerCase().includes(searchLower) ||
            user.phoneNumber?.includes(searchQuery) ||
            user.displayName?.toLowerCase().includes(searchLower) ||
            user.username?.toLowerCase().includes(searchLower) ||
            user.firstName?.toLowerCase().includes(searchLower) ||
            user.lastName?.toLowerCase().includes(searchLower) ||
            user.strapiId?.toString().includes(searchQuery)
          );
        });
      }

      if (sort) {
        const [sortField, sortOrder] = sort.split(":");

        sortedUsers = [...sortedUsers].sort((a, b) => {
          let aValue = a[sortField];
          let bValue = b[sortField];

          // Special handling for createdAt and lastSignInTime - use Firebase metadata
          if (sortField === "createdAt") {
            aValue = aValue || a.metadata?.creationTime;
            bValue = bValue || b.metadata?.creationTime;
          } else if (sortField === "lastSignInTime") {
            // For Last Sign In, only use Firebase metadata (no fallback to Strapi updatedAt)
            aValue = a.metadata?.lastSignInTime;
            bValue = b.metadata?.lastSignInTime;
          }

          // Handle null/undefined values - push them to the end
          if (aValue == null && bValue == null) return 0;
          if (aValue == null) return 1;
          if (bValue == null) return -1;

          // For date fields (createdAt, lastSignInTime), parse as dates
          if (sortField === "createdAt" || sortField === "lastSignInTime") {
            const aDate = new Date(aValue).getTime();
            const bDate = new Date(bValue).getTime();
            return sortOrder === "DESC" ? bDate - aDate : aDate - bDate;
          }

          // For numeric fields, use numeric comparison
          if (typeof aValue === "number" && typeof bValue === "number") {
            return sortOrder === "DESC" ? bValue - aValue : aValue - bValue;
          }

          // For string fields, use locale comparison
          const comparison = String(aValue).toLowerCase().localeCompare(String(bValue).toLowerCase());

          return sortOrder === "DESC" ? -comparison : comparison;
        });
      }

      // Apply pagination after sorting/filtering - ensure page is at least 1
      if (sort || searchQuery) {
        const page = pagination.page || 1;
        const pageSize = parseInt(pagination.pageSize);
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        paginatedData = sortedUsers.slice(startIndex, endIndex);
      }

      const { meta } = paginate(
        sort || searchQuery ? sortedUsers : allFirebaseUsers.users,
        sort || searchQuery ? sortedUsers.length : totalUserscount.users.length,
        pagination
      );
      return { data: paginatedData, pageToken: allFirebaseUsers.pageToken, meta };
    },

    updateFirebaseUser: async (entityId, payload) => {
      try {
        ensureFirebaseInitialized();
        return await strapi.firebase.auth().updateUser(entityId, payload);
      } catch (e) {
        throw new errors.ApplicationError(e.message.toString());
      }
    },
    update: async (entityId, payload) => {
      try {
        ensureFirebaseInitialized();

        // Get Strapi user via firebase_user_data link
        const firebaseData = await strapi
          .plugin("firebase-authentication")
          .service("firebaseUserDataService")
          .getByFirebaseUID(entityId);

        if (!firebaseData?.user) {
          throw new errors.NotFoundError(`User not found for Firebase UID: ${entityId}`);
        }

        // Filter payload - ONLY Firebase-compatible fields (security best practice)
        const firebasePayload: any = {};
        if (payload.email !== undefined) firebasePayload.email = payload.email;
        if (payload.phoneNumber !== undefined) firebasePayload.phoneNumber = payload.phoneNumber;
        if (payload.displayName !== undefined) firebasePayload.displayName = payload.displayName;
        if (payload.photoURL !== undefined) firebasePayload.photoURL = payload.photoURL;
        if (payload.disabled !== undefined) firebasePayload.disabled = payload.disabled;
        if (payload.emailVerified !== undefined) firebasePayload.emailVerified = payload.emailVerified;
        if (payload.password !== undefined) firebasePayload.password = payload.password;

        // Update Firebase with filtered payload
        const firebasePromise = strapi.firebase.auth().updateUser(entityId, firebasePayload);

        // Prepare Strapi payload with field mapping
        const strapiPayload: any = {};

        // Direct field mappings
        if (payload.email !== undefined) {
          strapiPayload.email = payload.email;
        }

        if (payload.phoneNumber !== undefined) {
          strapiPayload.phoneNumber = payload.phoneNumber;
        }

        // displayName → firstName + lastName transformation (handle empty string explicitly)
        if (payload.displayName !== undefined) {
          if (payload.displayName) {
            const nameParts = payload.displayName.trim().split(" ");
            strapiPayload.firstName = nameParts[0] || "";
            strapiPayload.lastName = nameParts.slice(1).join(" ") || "";
          } else {
            // Clear names if displayName is explicitly set to empty
            strapiPayload.firstName = "";
            strapiPayload.lastName = "";
          }
        }

        // disabled → blocked semantic mapping
        if (typeof payload.disabled === "boolean") {
          strapiPayload.blocked = payload.disabled;
        }

        // Update Strapi using db.query() for consistency with codebase pattern
        const strapiPromise =
          Object.keys(strapiPayload).length > 0
            ? strapi.db.query("plugin::users-permissions.user").update({
                where: { documentId: firebaseData.user.documentId },
                data: strapiPayload,
              })
            : Promise.resolve(firebaseData.user);

        // Execute both updates (allows partial success/failure)
        const results = await Promise.allSettled([firebasePromise, strapiPromise]);

        // Audit logging for security compliance
        strapi.log.info("User update operation", {
          userId: entityId,
          firebaseStatus: results[0].status,
          strapiStatus: results[1].status,
          updatedFields: Object.keys(firebasePayload),
        });

        // Log partial failures for manual reconciliation
        if (results[0].status === "rejected" || results[1].status === "rejected") {
          strapi.log.error("Partial update failure detected", {
            userId: entityId,
            firebaseError: results[0].status === "rejected" ? results[0].reason : null,
            strapiError: results[1].status === "rejected" ? results[1].reason : null,
          });
        }

        return results;
      } catch (e) {
        // Map Firebase-specific error codes to ValidationError for proper HTTP status
        if (e.code === "auth/email-already-exists") {
          throw new errors.ValidationError("Email address is already in use by another account");
        }
        if (e.code === "auth/phone-number-already-exists") {
          throw new errors.ValidationError("Phone number is already in use by another account");
        }
        if (e.code === "auth/invalid-email") {
          throw new errors.ValidationError("Invalid email address format");
        }
        if (e.code === "auth/invalid-phone-number") {
          throw new errors.ValidationError("Invalid phone number format");
        }

        throw new errors.ApplicationError(e.message.toString());
      }
    },
    resetPasswordFirebaseUser: async (entityId, payload) => {
      try {
        ensureFirebaseInitialized();
        const result = await strapi.firebase.auth().updateUser(entityId, payload);

        // Revoke all refresh tokens (best-effort, don't block on failure)
        try {
          await strapi.firebase.auth().revokeRefreshTokens(entityId);
        } catch (revokeError: any) {
          strapi.log.warn(`Session revocation failed: ${revokeError.message}`);
        }

        // Send password changed confirmation email (don't block on failure)
        try {
          const firebaseUser = await strapi.firebase.auth().getUser(entityId);
          const emailService = strapi.plugin("firebase-authentication").service("emailService");
          await emailService.sendPasswordChangedEmail(firebaseUser);
        } catch (emailError: any) {
          strapi.log.warn(`Could not send password changed confirmation: ${emailError.message}`);
        }

        return result;
      } catch (e) {
        throw new errors.ApplicationError(e.message.toString());
      }
    },
    resetPasswordStrapiUser: async (entityId, payload) => {
      try {
        const firebaseData = await strapi
          .plugin("firebase-authentication")
          .service("firebaseUserDataService")
          .getByFirebaseUID(entityId);

        if (!firebaseData?.user) {
          throw new errors.NotFoundError(`User not found for Firebase UID: ${entityId}`);
        }

        return await strapi.db.query("plugin::users-permissions.user").update({
          where: { documentId: firebaseData.user.documentId },
          data: payload,
        });
      } catch (e) {
        throw new errors.ApplicationError(e.message.toString());
      }
    },
    resetPassword: async (entityId, payload) => {
      try {
        ensureFirebaseInitialized();

        const firebaseData = await strapi
          .plugin("firebase-authentication")
          .service("firebaseUserDataService")
          .getByFirebaseUID(entityId);

        if (!firebaseData?.user) {
          throw new errors.NotFoundError(`User not found for Firebase UID: ${entityId}`);
        }

        const firebasePromise = strapi.firebase.auth().updateUser(entityId, payload);
        const strapiPromise = strapi.db.query("plugin::users-permissions.user").update({
          where: { documentId: firebaseData.user.documentId },
          data: payload,
        });

        const results = await Promise.allSettled([firebasePromise, strapiPromise]);

        // Only proceed with post-password-change actions if Firebase update succeeded
        if (results[0].status === "fulfilled") {
          // Revoke all refresh tokens (best-effort, don't block on failure)
          try {
            await strapi.firebase.auth().revokeRefreshTokens(entityId);
          } catch (revokeError: any) {
            strapi.log.warn(`Session revocation failed: ${revokeError.message}`);
          }

          // Send password changed confirmation email (don't block on failure)
          try {
            const firebaseUser = await strapi.firebase.auth().getUser(entityId);
            const emailService = strapi.plugin("firebase-authentication").service("emailService");
            await emailService.sendPasswordChangedEmail(firebaseUser);
          } catch (emailError: any) {
            strapi.log.warn(`Could not send password changed confirmation: ${emailError.message}`);
          }
        }

        return results;
      } catch (e) {
        throw new errors.ApplicationError(e.message.toString());
      }
    },
    delete: async (entityId) => {
      try {
        ensureFirebaseInitialized();

        const firebaseData = await strapi
          .plugin("firebase-authentication")
          .service("firebaseUserDataService")
          .getByFirebaseUID(entityId);

        if (!firebaseData?.user) {
          throw new errors.NotFoundError(`User not found for Firebase UID: ${entityId}`);
        }

        const firebasePromise = strapi.firebase.auth().deleteUser(entityId);
        const strapiPromise = strapi.db.query("plugin::users-permissions.user").delete({
          where: { documentId: firebaseData.user.documentId },
        });
        return Promise.allSettled([firebasePromise, strapiPromise]);
      } catch (e) {
        throw new errors.ApplicationError(e.message.toString());
      }
    },
    deleteFirebaseUser: async (entityId) => {
      try {
        ensureFirebaseInitialized();
        const response = await strapi.firebase.auth().deleteUser(entityId);
        return response;
      } catch (e) {
        throw new errors.ApplicationError(e.message.toString());
      }
    },
    deleteStrapiUser: async (entityId) => {
      try {
        const firebaseData = await strapi
          .plugin("firebase-authentication")
          .service("firebaseUserDataService")
          .getByFirebaseUID(entityId);

        if (!firebaseData?.user) {
          throw new errors.NotFoundError(`User not found for Firebase UID: ${entityId}`);
        }

        const response = await strapi.db.query("plugin::users-permissions.user").delete({
          where: { documentId: firebaseData.user.documentId },
        });
        return response;
      } catch (e) {
        throw new errors.ApplicationError(e.message.toString());
      }
    },
    deleteMany: async (entityIDs) => {
      try {
        ensureFirebaseInitialized();

        // Validate and parse entityIDs safely
        let parsedIDs;
        if (typeof entityIDs === "string") {
          try {
            parsedIDs = JSON.parse(entityIDs);
          } catch (parseError) {
            throw new errors.ValidationError("Invalid JSON format for entity IDs");
          }
        } else if (Array.isArray(entityIDs)) {
          parsedIDs = entityIDs;
        } else {
          throw new errors.ValidationError("Entity IDs must be a JSON string or array");
        }

        // Validate that all IDs are strings
        if (!Array.isArray(parsedIDs) || !parsedIDs.every((id) => typeof id === "string")) {
          throw new errors.ValidationError("Entity IDs must be an array of strings");
        }

        // Validate that we have at least one ID
        if (parsedIDs.length === 0) {
          throw new errors.ValidationError("At least one entity ID is required");
        }

        const response = await strapi.firebase.auth().deleteUsers(parsedIDs);
        return response;
      } catch (e) {
        if (e instanceof errors.ValidationError) {
          throw e;
        }
        strapi.log.error("deleteMany error:", e);
        throw new errors.ApplicationError(e.message?.toString() || "Failed to delete users");
      }
    },
    async setSocialMetaData() {},

    /**
     * Send password reset email with custom JWT token
     * @param entityId - Firebase UID of the user
     */
    sendPasswordResetEmail: async (entityId: string) => {
      try {
        ensureFirebaseInitialized();

        // Get the Firebase user to get their email
        const user = await strapi.firebase.auth().getUser(entityId);

        if (!user.email) {
          throw new errors.ApplicationError("User does not have an email address");
        }

        // Get the password reset URL from configuration
        const config = await strapi.db
          .query("plugin::firebase-authentication.firebase-authentication-configuration")
          .findOne({ where: {} });

        const passwordResetUrl = config?.passwordResetUrl || "http://localhost:3000/reset-password";

        // Find the firebase-user-data record for this Firebase user
        const firebaseUserData = await strapi
          .plugin("firebase-authentication")
          .service("firebaseUserDataService")
          .getByFirebaseUID(entityId);

        if (!firebaseUserData) {
          throw new errors.ApplicationError("User is not linked to Firebase authentication");
        }

        // Generate custom JWT token using tokenService
        const tokenService = strapi.plugin("firebase-authentication").service("tokenService");
        const token = await tokenService.generateResetToken(firebaseUserData.documentId);

        // Build the reset link using admin-configured URL + our token
        const resetLink = `${passwordResetUrl}?token=${token}`;

        strapi.log.debug(`Generated password reset link for user ${user.email}`);

        // Use the email service to send the email
        const emailService = strapi.plugin("firebase-authentication").service("emailService");

        return await emailService.sendPasswordResetEmail(user, resetLink);
      } catch (e: any) {
        strapi.log.error(`sendPasswordResetEmail error: ${e.message}`);
        throw new errors.ApplicationError(e.message?.toString() || "Failed to send password reset email");
      }
    },

    /**
     * Send password reset email by email address (for public self-service)
     * @param email - Email address of the user
     */
    sendPasswordResetEmailByEmail: async (email: string) => {
      try {
        ensureFirebaseInitialized();

        // Try to find the Firebase user by email
        let firebaseUser;
        try {
          firebaseUser = await strapi.firebase.auth().getUserByEmail(email);
        } catch (e: any) {
          // Don't reveal if email exists or not (security best practice)
          strapi.log.debug(`Password reset requested for non-existent email: ${email}`);
          return {
            success: true,
            message: "If an account with that email exists, a password reset link has been sent.",
          };
        }

        // Call the existing method with Firebase UID
        const userService = strapi.plugin("firebase-authentication").service("userService");
        await userService.sendPasswordResetEmail(firebaseUser.uid);

        return {
          success: true,
          message: "If an account with that email exists, a password reset link has been sent.",
        };
      } catch (e: any) {
        strapi.log.error(`sendPasswordResetEmailByEmail error: ${e.message}`);
        // Return generic success to prevent email enumeration
        return {
          success: true,
          message: "If an account with that email exists, a password reset link has been sent.",
        };
      }
    },

    /**
     * Reset password using a custom JWT token
     * @param token - The JWT token from the reset URL
     * @param newPassword - The new password
     */
    resetPasswordWithToken: async (token: string, newPassword: string) => {
      try {
        ensureFirebaseInitialized();

        // Validate password length (Firebase minimum is 6 characters)
        if (!newPassword || newPassword.length < 6) {
          throw new errors.ValidationError("Password must be at least 6 characters long");
        }

        // Validate token using tokenService
        const tokenService = strapi.plugin("firebase-authentication").service("tokenService");
        const validationResult = await tokenService.validateResetToken(token);

        if (!validationResult.valid) {
          throw new errors.ValidationError(validationResult.error || "Invalid or expired token");
        }

        const { firebaseUserDataDocumentId, firebaseUID } = validationResult;

        // Update password in Firebase
        await strapi.firebase.auth().updateUser(firebaseUID, {
          password: newPassword,
        });

        // Revoke all existing sessions (security best practice)
        await strapi.firebase.auth().revokeRefreshTokens(firebaseUID);

        // Invalidate the token so it can't be reused
        await tokenService.invalidateResetToken(firebaseUserDataDocumentId);

        strapi.log.info(`Password reset completed for Firebase user ${firebaseUID}`);

        // Send confirmation email (don't block on failure)
        try {
          const firebaseUser = await strapi.firebase.auth().getUser(firebaseUID);
          const emailService = strapi.plugin("firebase-authentication").service("emailService");
          await emailService.sendPasswordChangedEmail(firebaseUser);
        } catch (emailError: any) {
          // Log but don't fail the password reset
          strapi.log.warn(`Could not send password changed confirmation: ${emailError.message}`);
        }

        return { success: true, message: "Password has been reset successfully" };
      } catch (e: any) {
        strapi.log.error(`resetPasswordWithToken error: ${e.message}`);

        // Map Firebase-specific errors
        if (e.code === "auth/user-not-found") {
          throw new errors.NotFoundError("User not found");
        }
        if (e.code === "auth/invalid-password" || e.code === "auth/weak-password") {
          throw new errors.ValidationError("Password must be at least 6 characters long");
        }

        // Re-throw validation errors as-is
        if (e instanceof errors.ValidationError) {
          throw e;
        }

        throw new errors.ApplicationError(e.message?.toString() || "Failed to reset password");
      }
    },

    /**
     * Send email verification email (admin-initiated)
     * @param entityId - Firebase UID of the user
     */
    sendVerificationEmail: async (entityId: string) => {
      try {
        ensureFirebaseInitialized();

        // Get the Firebase user to get their email
        const user = await strapi.firebase.auth().getUser(entityId);

        if (!user.email) {
          throw new errors.ApplicationError("User does not have an email address");
        }

        // Check if already verified
        if (user.emailVerified) {
          return { success: true, message: "Email is already verified" };
        }

        // Get the email verification URL from configuration
        const config = await strapi.db
          .query("plugin::firebase-authentication.firebase-authentication-configuration")
          .findOne({ where: {} });

        const emailVerificationUrl = config?.emailVerificationUrl;
        if (!emailVerificationUrl) {
          throw new errors.ApplicationError("Email verification URL is not configured");
        }

        // Find the firebase-user-data record for this Firebase user
        const firebaseUserData = await strapi
          .plugin("firebase-authentication")
          .service("firebaseUserDataService")
          .getByFirebaseUID(entityId);

        if (!firebaseUserData) {
          throw new errors.ApplicationError("User is not linked to Firebase authentication");
        }

        // Generate custom JWT token using tokenService (with email for change detection)
        const tokenService = strapi.plugin("firebase-authentication").service("tokenService");
        const token = await tokenService.generateVerificationToken(firebaseUserData.documentId, user.email);

        // Build the verification link using admin-configured URL + our token
        const verificationLink = `${emailVerificationUrl}?token=${token}`;

        strapi.log.debug(`Generated email verification link for user ${user.email}`);

        // Use the email service to send the email
        const emailService = strapi.plugin("firebase-authentication").service("emailService");

        return await emailService.sendVerificationEmail(user, verificationLink);
      } catch (e: any) {
        strapi.log.error(`sendVerificationEmail error: ${e.message}`);
        throw new errors.ApplicationError(e.message?.toString() || "Failed to send verification email");
      }
    },
  };
};

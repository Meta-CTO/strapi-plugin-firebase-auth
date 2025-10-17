import { errors } from "@strapi/utils";

import paginate from "../utils/paginate";
import { formatUserData } from "../utils/users";

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
        throw new errors.ApplicationError('Either email or phoneNumber is required');
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
      const link = await strapi.firebase.auth().generatePasswordResetLink(payload.email, actionCodeSettings);
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
        if (searchQuery.startsWith('+') || searchQuery.match(/^\d{10,15}$/)) {
          // Ensure phone has + prefix for Firebase lookup
          const phoneWithPlus = searchQuery.startsWith('+') ? searchQuery : `+${searchQuery}`;
          try {
            foundUser = await strapi.firebase.auth().getUserByPhoneNumber(phoneWithPlus);
          } catch (e) {
            // Not a valid phone, continue
          }
        }

        // Try exact email lookup
        if (!foundUser && searchQuery.includes('@')) {
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

            if (strapiUser?.firebaseUserID) {
              foundUser = await strapi.firebase.auth().getUser(strapiUser.firebaseUserID);
            } else if (strapiUser) {
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
          } catch (e) {
            // Not a valid Strapi ID, continue
          }
        }

        // If we found an exact match, return it immediately
        if (foundUser) {
          const totalUserscount = await strapi.firebase.auth().listUsers();
          const strapiUsers = await strapi.db
            .query("plugin::users-permissions.user")
            .findMany();

          const formattedUser = formatUserData({ users: [foundUser] }, strapiUsers);

          const { meta } = paginate(
            formattedUser.users,
            1, // Only 1 result for exact match
            pagination,
          );

          return { data: formattedUser.users, pageToken: undefined, meta };
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
    const strapiUsers = await strapi.db
      .query("plugin::users-permissions.user")
      .findMany();

    const allUsers = formatUserData(allFirebaseUsers, strapiUsers);

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
      const [sortField, sortOrder] = sort.split(':');

      sortedUsers = [...sortedUsers].sort((a, b) => {
        let aValue = a[sortField];
        let bValue = b[sortField];

        // Special handling for createdAt and lastSignInTime - use Firebase metadata
        if (sortField === 'createdAt') {
          aValue = aValue || a.metadata?.creationTime;
          bValue = bValue || b.metadata?.creationTime;
        } else if (sortField === 'lastSignInTime') {
          // For Last Sign In, only use Firebase metadata (no fallback to Strapi updatedAt)
          aValue = a.metadata?.lastSignInTime;
          bValue = b.metadata?.lastSignInTime;
        }

        // Handle null/undefined values - push them to the end
        if (aValue == null && bValue == null) return 0;
        if (aValue == null) return 1;
        if (bValue == null) return -1;

        // For date fields (createdAt, lastSignInTime), parse as dates
        if (sortField === 'createdAt' || sortField === 'lastSignInTime') {
          const aDate = new Date(aValue).getTime();
          const bDate = new Date(bValue).getTime();
          return sortOrder === 'DESC' ? bDate - aDate : aDate - bDate;
        }

        // For numeric fields, use numeric comparison
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortOrder === 'DESC' ? bValue - aValue : aValue - bValue;
        }

        // For string fields, use locale comparison
        const comparison = String(aValue).toLowerCase().localeCompare(String(bValue).toLowerCase());

        return sortOrder === 'DESC' ? -comparison : comparison;
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
      pagination,
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
      const firebasePromise = strapi.firebase.auth().updateUser(entityId, payload);

      return Promise.allSettled([firebasePromise]);
    } catch (e) {
      throw new errors.ApplicationError(e.message.toString());
    }
  },
  resetPasswordFirebaseUser: async (entityId, payload) => {
    try {
      ensureFirebaseInitialized();
      return await strapi.firebase.auth().updateUser(entityId, payload);
    } catch (e) {
      throw new errors.ApplicationError(e.message.toString());
    }
  },
  resetPasswordStrapiUser: async (entityId, payload) => {
    try {
      return strapi.db
        .query("plugin::users-permissions.user")
        .update({ where: { firebaseUserID: entityId }, data: payload });
    } catch (e) {
      throw new errors.ApplicationError(e.message.toString());
    }
  },
  resetPassword: async (entityId, payload) => {
    try {
      ensureFirebaseInitialized();
      const firebasePromise = strapi.firebase.auth().updateUser(entityId, payload);
      const strapiPromise = strapi.db
        .query("plugin::users-permissions.user")
        .update({ where: { firebaseUserID: entityId }, data: payload });

      return Promise.allSettled([firebasePromise, strapiPromise]);
    } catch (e) {
      throw new errors.ApplicationError(e.message.toString());
    }
  },
  delete: async (entityId) => {
    try {
      ensureFirebaseInitialized();
      const firebasePromise = strapi.firebase.auth().deleteUser(entityId);
      const strapiPromise = strapi.db
        .query("plugin::users-permissions.user")
        .delete({ where: { firebaseUserID: entityId } });
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
      const response = await strapi.db
        .query("plugin::users-permissions.user")
        .delete({ where: { firebaseUserID: entityId } });
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
      if (typeof entityIDs === 'string') {
        try {
          parsedIDs = JSON.parse(entityIDs);
        } catch (parseError) {
          throw new errors.ValidationError('Invalid JSON format for entity IDs');
        }
      } else if (Array.isArray(entityIDs)) {
        parsedIDs = entityIDs;
      } else {
        throw new errors.ValidationError('Entity IDs must be a JSON string or array');
      }

      // Validate that all IDs are strings
      if (!Array.isArray(parsedIDs) || !parsedIDs.every(id => typeof id === 'string')) {
        throw new errors.ValidationError('Entity IDs must be an array of strings');
      }

      // Validate that we have at least one ID
      if (parsedIDs.length === 0) {
        throw new errors.ValidationError('At least one entity ID is required');
      }

      const response = await strapi.firebase.auth().deleteUsers(parsedIDs);
      return response;
    } catch (e) {
      if (e instanceof errors.ValidationError) {
        throw e;
      }
      strapi.log.error('deleteMany error:', e);
      throw new errors.ApplicationError(e.message?.toString() || 'Failed to delete users');
    }
  },
  async setSocialMetaData() {},

  sendPasswordResetEmail: async (entityId) => {
    try {
      ensureFirebaseInitialized();

      // Get the user to get their email
      const user = await strapi.firebase.auth().getUser(entityId);

      if (!user.email) {
        throw new errors.ApplicationError("User does not have an email address");
      }

      // Get the password reset URL from configuration
      const config = await strapi.db
        .query("plugin::firebase-authentication.firebase-authentication-configuration")
        .findOne({ where: {} });

      const passwordResetUrl = config?.passwordResetUrl || "http://localhost:3000/reset-password";

      let resetLink;
      try {
        // Generate password reset link using Firebase Admin SDK with timeout
        const actionCodeSettings = {
          url: passwordResetUrl,
          handleCodeInApp: true,
        };

        // Create a promise that rejects after 10 seconds with proper typing
        const timeoutPromise = new Promise<string>((_, reject) => {
          setTimeout(() => reject(new Error("Firebase generatePasswordResetLink timeout after 10 seconds")), 10000);
        });

        // Race between the Firebase call and the timeout
        resetLink = await Promise.race([
          strapi.firebase.auth().generatePasswordResetLink(user.email, actionCodeSettings),
          timeoutPromise
        ]);
      } catch (firebaseError: any) {
        strapi.log.error(`Failed to generate Firebase reset link: ${firebaseError.message}`);
        // Use a fallback reset link if Firebase fails
        resetLink = `${passwordResetUrl}?email=${encodeURIComponent(user.email)}&error=firebase_link_generation_failed`;
      }

      // Use the new email service
      const emailService = strapi
        .plugin('firebase-authentication')
        .service('emailService');

      return await emailService.sendPasswordResetEmail(user, resetLink);
    } catch (e: any) {
      strapi.log.error(`sendPasswordResetEmail error: ${e.message}`);
      throw new errors.ApplicationError(e.message?.toString() || "Failed to send password reset email");
    }
  },
  };
};

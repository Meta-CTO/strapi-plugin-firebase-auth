import type { Core } from "@strapi/strapi";

export interface LinkResult {
  totalStrapiUsers: number;
  totalFirebaseUsers: number;
  linked: number;
  skipped: number;
  errors: number;
}

/**
 * Auto-Link Service
 *
 * Automatically links existing Strapi users with their Firebase counterparts
 * by matching email and phone numbers.
 *
 * Runs on every Strapi startup in the background (non-blocking).
 */
export default {
  /**
   * Link all Strapi users with matching Firebase users
   *
   * This runs automatically on Strapi startup to ensure all users
   * who exist in both Strapi and Firebase are properly linked.
   *
   * @param strapi - Strapi instance
   * @returns Promise<LinkResult> - Summary of linking operation
   */
  async linkAllUsers(strapi: Core.Strapi): Promise<LinkResult> {
    const result: LinkResult = {
      totalStrapiUsers: 0,
      totalFirebaseUsers: 0,
      linked: 0,
      skipped: 0,
      errors: 0,
    };

    try {
      strapi.log.info("Auto-linking Strapi users with Firebase users...");

      // Check if Firebase is initialized
      // @ts-ignore - firebase property is added dynamically
      if (!strapi.firebase) {
        strapi.log.warn("Firebase not initialized - skipping auto-linking");
        return result;
      }

      // Step 1: Get all Strapi users with email or phone
      const strapiUsers = await strapi.db.query("plugin::users-permissions.user").findMany({
        select: ["id", "documentId", "username", "email", "phoneNumber"],
        where: {
          $or: [{ email: { $notNull: true } }, { phoneNumber: { $notNull: true } }],
        },
      });

      result.totalStrapiUsers = strapiUsers.length;

      if (strapiUsers.length === 0) {
        strapi.log.info("No Strapi users to link");
        return result;
      }

      // Step 2: Get all Firebase users
      const firebaseUsers: any[] = [];
      let nextPageToken;

      do {
        // @ts-ignore
        const listUsersResult = await strapi.firebase.auth().listUsers(1000, nextPageToken);
        firebaseUsers.push(...listUsersResult.users);
        nextPageToken = listUsersResult.pageToken;
      } while (nextPageToken);

      result.totalFirebaseUsers = firebaseUsers.length;

      if (firebaseUsers.length === 0) {
        strapi.log.info("No Firebase users found - skipping auto-linking");
        return result;
      }

      // Step 3: Create lookup maps for efficient matching
      const firebaseByEmail = new Map<string, any>();
      const firebaseByPhone = new Map<string, any>();

      for (const fbUser of firebaseUsers) {
        if (fbUser.email) {
          firebaseByEmail.set(fbUser.email.toLowerCase(), fbUser);
        }
        if (fbUser.phoneNumber) {
          firebaseByPhone.set(fbUser.phoneNumber, fbUser);
        }
      }

      // Step 4: Link users
      for (const strapiUser of strapiUsers) {
        let firebaseUser = null; // Declare at loop scope so it's accessible in catch block

        try {
          // Check if already linked (fast query - only check link table)
          const existing = await strapi.db
            .query("plugin::firebase-authentication.firebase-user-data")
            .findOne({
              select: ["id"],
              where: { user: { documentId: strapiUser.documentId } },
            });

          if (existing) {
            result.skipped++;
            continue;
          }

          // Try to find matching Firebase user by email
          firebaseUser = null;
          if (strapiUser.email) {
            firebaseUser = firebaseByEmail.get(strapiUser.email.toLowerCase());
          }

          // Fallback: Try phone number
          if (!firebaseUser && strapiUser.phoneNumber) {
            firebaseUser = firebaseByPhone.get(strapiUser.phoneNumber);
          }

          if (!firebaseUser) {
            result.skipped++;
            continue;
          }

          // Pre-flight Check 2: Check if Firebase UID is already linked to a DIFFERENT user
          const existingUIDLink = await strapi.db
            .query("plugin::firebase-authentication.firebase-user-data")
            .findOne({
              where: { firebaseUserID: firebaseUser.uid },
              populate: ["user"],
            });

          if (existingUIDLink && existingUIDLink.user?.documentId !== strapiUser.documentId) {
            // This Firebase UID is already linked to a different Strapi user
            strapi.log.warn(
              `⚠️ [Auto-Link] Skipping '${strapiUser.username || strapiUser.email}' - Firebase UID already linked`
            );
            strapi.log.warn(`   Strapi User: ${strapiUser.email} (documentId: ${strapiUser.documentId})`);
            strapi.log.warn(`   Firebase UID: ${firebaseUser.uid}`);
            strapi.log.warn(
              `   Already linked to: ${existingUIDLink.user?.email} (documentId: ${existingUIDLink.user?.documentId})`
            );
            strapi.log.warn(`   Action: Resolve duplicate users or manually unlink conflicting record`);
            result.skipped++;
            continue;
          }

          // Found match! Create link
          try {
            const firebaseData: any = {
              firebaseUserID: firebaseUser.uid,
            };

            // Check if it's an Apple Private Relay email
            if (firebaseUser.email && firebaseUser.email.includes("privaterelay.appleid.com")) {
              firebaseData.appleEmail = firebaseUser.email;
            }

            await strapi
              .plugin("firebase-authentication")
              .service("firebaseUserDataService")
              .updateForUser(strapiUser.documentId, firebaseData);

            result.linked++;
            strapi.log.debug(`Linked ${strapiUser.username} → Firebase UID ${firebaseUser.uid}`);
          } catch (createError: any) {
            // Handle unique constraint violations (Firebase UID already linked)
            if (createError.code === "23505") {
              result.skipped++;
              continue;
            }
            throw createError;
          }
        } catch (error) {
          // Handle unique constraint violations from Strapi validation layer
          if (error.message?.includes("This attribute must be unique")) {
            strapi.log.warn(
              `⚠️ [Auto-Link] Unique constraint conflict for '${strapiUser.username || strapiUser.email}'`
            );
            strapi.log.warn(`   Strapi User: ${strapiUser.email} (documentId: ${strapiUser.documentId})`);
            if (firebaseUser) {
              strapi.log.warn(`   Firebase UID: ${firebaseUser.uid}`);
              strapi.log.warn(`   Cause: This Firebase UID is already linked to another Strapi user`);
              strapi.log.warn(
                `   Action: Query firebase_user_data table to find conflict - WHERE firebase_user_id = '${firebaseUser.uid}'`
              );
            }
            result.skipped++;
          } else {
            // Unexpected errors
            result.errors++;
            strapi.log.error(
              `❌ [Auto-Link] Unexpected error linking user '${strapiUser.username || strapiUser.email}': ${error.message}`
            );
          }
        }
      }

      // Log summary
      if (result.errors > 0) {
        strapi.log.error(
          `❌ Auto-linking completed with unexpected errors: ${result.linked} linked, ${result.skipped} skipped, ${result.errors} errors`
        );
        strapi.log.error(`   Review error logs above for resolution steps`);
      } else {
        strapi.log.info(
          `✅ Auto-linking complete: ${result.linked} linked, ${result.skipped} skipped, ${result.errors} errors`
        );
      }
      strapi.log.info(
        `   Total: ${result.totalStrapiUsers} Strapi users, ${result.totalFirebaseUsers} Firebase users`
      );
    } catch (error) {
      strapi.log.error(`❌ Fatal error during auto-linking: ${error.message}`);
    }

    return result;
  },
};

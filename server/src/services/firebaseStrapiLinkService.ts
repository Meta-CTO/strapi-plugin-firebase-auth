/**
 * Firebase-Strapi Link Service
 *
 * Links Firebase users with Strapi users via the firebase_user_data table.
 * Uses Firebase UID as the sole source of truth for linking.
 */

export default ({ strapi }) => ({
  /**
   * Builds a Map of Firebase UID → Strapi User for O(1) lookups
   *
   * Fetches all firebase_user_data records with populated user relation.
   * Uses Document Service API for proper Strapi v5 relation handling.
   *
   * @returns Map<firebaseUID, strapiUserWithAppleEmail>
   */
  async buildUserMap() {
    try {
      // Fetch all firebase_user_data records with populated user relation
      const records = await strapi.documents("plugin::firebase-authentication.firebase-user-data").findMany({
        populate: ["user"],
        fields: ["firebaseUserID", "appleEmail"],
        limit: 10000, // High limit to fetch all records
        start: 0,
      });

      // Filter valid records and build Map for O(1) lookups
      const validRecords = records.filter((r) => r.firebaseUserID && r.user);

      if (validRecords.length !== records.length) {
        strapi.log.warn(
          `Found ${records.length - validRecords.length} orphaned firebase_user_data records (no linked user)`
        );
      }

      return new Map(
        validRecords.map((r) => [
          r.firebaseUserID,
          {
            ...r.user,
            appleEmail: r.appleEmail,
            firebaseUserID: r.firebaseUserID,
          },
        ])
      );
    } catch (error) {
      strapi.log.error("Failed to build user map:", error);
      // Return empty Map on error - allows graceful degradation
      return new Map();
    }
  },

  /**
   * Links Firebase users with Strapi data using firebase_user_data table
   *
   * Matching Strategy:
   * - ONLY uses Firebase UID → firebase_user_data.firebaseUserID
   * - firebase_user_data table is the source of truth
   * - No email/phone fallback (security risk from recycled identifiers)
   *
   * @param firebaseUsers - Array of Firebase user objects
   * @param uidToUserMap - Map from buildUserMap()
   * @param allStrapiUsers - Unused (kept for backward compatibility)
   * @returns Array of linked user objects with linkStatus and warnings
   */
  linkFirebaseUsers(firebaseUsers: any[], uidToUserMap: Map<string, any>, allStrapiUsers: any[]) {
    return firebaseUsers.map((fbUser) => {
      // ONLY match by Firebase UID from firebase_user_data table
      const matchedUser = uidToUserMap.get(fbUser.uid);

      // User not linked - no record in firebase_user_data table
      if (!matchedUser) {
        return {
          ...fbUser,
          id: fbUser.uid,
          linkStatus: "unlinked",
          matchMethod: null,
        };
      }

      // User IS linked - check for data drift warnings
      const warnings = [];
      if (
        matchedUser.email &&
        fbUser.email &&
        matchedUser.email.toLowerCase() !== fbUser.email.toLowerCase()
      ) {
        warnings.push("email_mismatch");
      }
      if (matchedUser.phoneNumber && fbUser.phoneNumber && matchedUser.phoneNumber !== fbUser.phoneNumber) {
        warnings.push("phone_mismatch");
      }

      // Merge data (Firebase takes precedence for auth fields)
      return {
        ...matchedUser, // Strapi data (base)
        ...fbUser, // Firebase data (authoritative for auth fields)
        // Preserve IDs
        strapiId: matchedUser.id,
        strapiDocumentId: matchedUser.documentId,
        firebaseUserID: fbUser.uid,
        id: fbUser.uid,
        // Link metadata
        linkStatus: "linked",
        matchMethod: "uid",
        warnings: warnings.length > 0 ? warnings : undefined,
        // Explicitly preserve critical fields
        displayName:
          fbUser.displayName ||
          matchedUser.displayName ||
          (matchedUser.firstName && matchedUser.lastName
            ? `${matchedUser.firstName} ${matchedUser.lastName}`.trim()
            : null),
        phoneNumber: fbUser.phoneNumber || matchedUser.phoneNumber,
        email: fbUser.email || matchedUser.email,
        appleEmail: matchedUser.appleEmail,
        // Firebase metadata
        metadata: fbUser.metadata,
        emailVerified: fbUser.emailVerified,
        disabled: fbUser.disabled,
        providerData: fbUser.providerData,
        tokensValidAfterTime: fbUser.tokensValidAfterTime,
        photoURL: fbUser.photoURL,
      };
    });
  },
});

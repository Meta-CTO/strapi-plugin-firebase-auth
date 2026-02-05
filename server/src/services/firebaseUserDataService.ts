export default ({ strapi }) => ({
  /**
   * Find or create Firebase user data for a Strapi user
   * @param userId - Strapi user documentId
   * @returns Firebase user data record
   */
  async findOrCreateForUser(userId: string) {
    // Validate userId format
    if (!userId || typeof userId !== "string") {
      throw new Error("Invalid user documentId");
    }

    // Try to find existing record
    // Use Document Service API with filters
    let firebaseData = await strapi
      .documents("plugin::firebase-authentication.firebase-user-data")
      .findFirst({
        filters: { user: { documentId: { $eq: userId } } },
        populate: ["user"],
      });

    // Create if doesn't exist
    if (!firebaseData) {
      // Note: firebaseUserID is required, so caller must provide it via updateForUser()
      // This method is mainly for internal use
      throw new Error("Firebase user data not found. Use updateForUser() to create with firebaseUserID.");
    }

    return firebaseData;
  },

  /**
   * Get Firebase user data by Firebase UID
   * @param firebaseUID - Firebase user ID
   * @returns Firebase user data with populated user
   */
  async getByFirebaseUID(firebaseUID: string) {
    // Use Document Service API with filters
    return await strapi.documents("plugin::firebase-authentication.firebase-user-data").findFirst({
      filters: { firebaseUserID: { $eq: firebaseUID } },
      populate: ["user"],
    });
  },

  /**
   * Update Firebase-specific fields for a user (creates if doesn't exist)
   * Handles orphaned records and race conditions gracefully
   * @param userId - Strapi user documentId
   * @param data - Fields to update
   */
  async updateForUser(
    userId: string,
    data: {
      firebaseUserID?: string;
      appleEmail?: string;
    }
  ) {
    // 1. Check by firebaseUserID first (handles orphan case proactively)
    if (data.firebaseUserID) {
      const existingByUID = await this.getByFirebaseUID(data.firebaseUserID);
      if (existingByUID) {
        // Check if this is the SAME user (re-linking) or truly orphaned
        const existingUserId = existingByUID.user?.documentId;

        if (existingUserId === userId) {
          // Same user - just update the record
          return await strapi.documents("plugin::firebase-authentication.firebase-user-data").update({
            documentId: existingByUID.documentId,
            data,
          });
        }

        if (existingUserId) {
          // UID is linked to a DIFFERENT active user - do NOT steal it
          strapi.log.warn(
            `[UID Conflict] Cannot link Firebase UID ${data.firebaseUserID} to user ${userId}. ` +
              `Already linked to user ${existingUserId}.`
          );
          throw new Error(
            `Firebase UID already linked to another user. ` +
              `Please contact support if you believe this is an error.`
          );
        }

        // Truly orphaned (user is null) - safe to adopt
        strapi.log.info(
          `[Orphan Recovery] Adopting orphaned firebase_user_data for UID ${data.firebaseUserID} to user ${userId}`
        );
        return await strapi.documents("plugin::firebase-authentication.firebase-user-data").update({
          documentId: existingByUID.documentId,
          data: { user: userId, ...data },
        });
      }
    }

    // 2. Check if user already has a record
    const existingByUser = await strapi
      .documents("plugin::firebase-authentication.firebase-user-data")
      .findFirst({
        filters: { user: { documentId: { $eq: userId } } },
      });

    if (existingByUser) {
      return await strapi.documents("plugin::firebase-authentication.firebase-user-data").update({
        documentId: existingByUser.documentId,
        data,
      });
    }

    // 3. Create new record
    if (!data.firebaseUserID) {
      throw new Error("firebaseUserID is required when creating firebase_user_data");
    }

    try {
      return await strapi.documents("plugin::firebase-authentication.firebase-user-data").create({
        data: { user: userId, ...data },
      });
    } catch (error) {
      // Race condition: another request created the record first (unique constraint violation)
      if (error.code === "23505" || error.message?.includes("unique constraint")) {
        strapi.log.info(
          `[Race Condition] Concurrent request created firebase_user_data for UID ${data.firebaseUserID}. Fetching existing record.`
        );

        // Fetch the record created by the concurrent request
        const raceWinner = await this.getByFirebaseUID(data.firebaseUserID);
        if (raceWinner) {
          // Check if it belongs to the same user
          if (raceWinner.user?.documentId === userId) {
            return raceWinner; // Same user - return the existing record
          }

          // Different user won the race - don't overwrite
          strapi.log.warn(
            `[Race Condition] UID ${data.firebaseUserID} was linked to different user ${raceWinner.user?.documentId} by concurrent request.`
          );
          throw new Error("Firebase UID was linked to another user by a concurrent request.");
        }
      }
      throw error;
    }
  },
});

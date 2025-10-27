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
    let firebaseData = await strapi.documents("plugin::firebase-authentication.firebase-user-data").findOne({
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
    return await strapi.documents("plugin::firebase-authentication.firebase-user-data").findOne({
      filters: { firebaseUserID: { $eq: firebaseUID } },
      populate: ["user"],
    });
  },

  /**
   * Update Firebase-specific fields for a user (creates if doesn't exist)
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
    // Try to find existing record
    // Use Document Service API with filters
    let firebaseData = await strapi.documents("plugin::firebase-authentication.firebase-user-data").findOne({
      filters: { user: { documentId: { $eq: userId } } },
    });

    if (!firebaseData) {
      // Create new record - firebaseUserID is required
      if (!data.firebaseUserID) {
        throw new Error("firebaseUserID is required when creating firebase_user_data");
      }

      try {
        // Use Document Service API - accepts documentId for relations
        return await strapi.documents("plugin::firebase-authentication.firebase-user-data").create({
          data: {
            user: userId,
            ...data,
          },
        });
      } catch (error) {
        // Handle race condition: another request created the record first
        if (error.code === "23505") {
          // PostgreSQL unique violation
          strapi.log.warn(`Race condition detected for user ${userId}, retrying findOne`);
          // Use Document Service API with filters
          firebaseData = await strapi
            .documents("plugin::firebase-authentication.firebase-user-data")
            .findOne({
              filters: { user: { documentId: { $eq: userId } } },
            });

          if (firebaseData) {
            // Update the existing record that was created by the concurrent request
            // Use Document Service API
            return await strapi.documents("plugin::firebase-authentication.firebase-user-data").update({
              documentId: firebaseData.documentId,
              data,
            });
          }
        }
        throw error;
      }
    }

    // Update existing record
    // Use Document Service API
    return await strapi.documents("plugin::firebase-authentication.firebase-user-data").update({
      documentId: firebaseData.documentId,
      data,
    });
  },
});

import type { Core } from "@strapi/strapi";

export interface LogActivityParams {
  firebaseUserId: string;
  strapiUserId?: string;
  activityType:
    | "authentication"
    | "tokenValidation"
    | "fieldUpdate"
    | "passwordReset"
    | "emailVerification"
    | "accountCreation"
    | "accountDeletion"
    | "adminAction";
  action: string;
  endpoint?: string;
  method?: string;
  ipAddress?: string;
  userAgent?: string;
  changes?: Record<string, { old: any; new: any }>;
  metadata?: Record<string, any>;
  success?: boolean;
  errorMessage?: string;
  performedBy?: string;
  performedByType?: "user" | "admin" | "system";
}

export interface GetActivityLogsOptions {
  page?: number;
  pageSize?: number;
  activityType?: string;
  startDate?: string;
  endDate?: string;
}

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  /**
   * Log an activity (non-blocking - errors are caught internally)
   * @param params - Activity log parameters
   * @returns Created activity log or undefined on error
   */
  async logActivity(params: LogActivityParams) {
    try {
      return await strapi.documents("plugin::firebase-authentication.firebase-activity-log").create({
        data: {
          ...params,
          success: params.success ?? true,
          performedByType: params.performedByType ?? "user",
        },
      });
    } catch (error) {
      // Log error but don't throw - logging should never break main flow
      strapi.log.error("[ActivityLog] Failed to log activity:", error);
    }
  },

  /**
   * Get paginated activity logs for a user with optional filters
   * @param firebaseUserId - Firebase UID
   * @param options - Pagination and filter options
   * @returns Array of activity logs
   */
  async getActivityLogs(firebaseUserId: string, options?: GetActivityLogsOptions) {
    const { page = 1, pageSize = 20, activityType, startDate, endDate } = options || {};

    const filters: any = { firebaseUserId: { $eq: firebaseUserId } };

    if (activityType && activityType !== "all") {
      filters.activityType = { $eq: activityType };
    }

    if (startDate) {
      filters.createdAt = { ...filters.createdAt, $gte: startDate };
    }

    if (endDate) {
      filters.createdAt = { ...filters.createdAt, $lte: endDate };
    }

    return strapi.documents("plugin::firebase-authentication.firebase-activity-log").findMany({
      filters,
      sort: { createdAt: "desc" },
      start: (page - 1) * pageSize,
      limit: pageSize,
    });
  },

  /**
   * Get total count for pagination
   * @param firebaseUserId - Firebase UID
   * @param options - Filter options
   * @returns Total count of matching logs
   */
  async getActivityCount(firebaseUserId: string, options?: GetActivityLogsOptions) {
    const { activityType, startDate, endDate } = options || {};

    const filters: any = { firebaseUserId: { $eq: firebaseUserId } };

    if (activityType && activityType !== "all") {
      filters.activityType = { $eq: activityType };
    }

    if (startDate) {
      filters.createdAt = { ...filters.createdAt, $gte: startDate };
    }

    if (endDate) {
      filters.createdAt = { ...filters.createdAt, $lte: endDate };
    }

    return strapi.documents("plugin::firebase-authentication.firebase-activity-log").count({
      filters,
    });
  },

  /**
   * Delete logs older than specified days
   * @param retentionDays - Number of days to retain logs
   * @returns Number of deleted entries
   */
  async cleanupOldLogs(retentionDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // Use db.query for bulk delete (more efficient)
    const result = await strapi.db.query("plugin::firebase-authentication.firebase-activity-log").deleteMany({
      where: { createdAt: { $lt: cutoffDate.toISOString() } },
    });

    return result?.count || 0;
  },
});

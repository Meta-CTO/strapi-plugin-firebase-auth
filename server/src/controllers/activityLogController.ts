import { errors } from "@strapi/utils";
import { Context, DefaultContext } from "koa";

export default {
  /**
   * GET /activity-logs?firebaseUserId=xxx&page=1&pageSize=20&activityType=...&startDate=...&endDate=...
   */
  async list(ctx: DefaultContext | Context) {
    const { firebaseUserId, page, pageSize, activityType, startDate, endDate } = ctx.query;

    if (!firebaseUserId) {
      throw new errors.ValidationError("firebaseUserId is required");
    }

    try {
      const activityLogService = strapi.plugin("firebase-authentication").service("activityLogService");

      const options = {
        page: parseInt(page as string) || 1,
        pageSize: parseInt(pageSize as string) || 20,
        activityType: activityType as string,
        startDate: startDate as string,
        endDate: endDate as string,
      };

      const [logs, total] = await Promise.all([
        activityLogService.getActivityLogs(firebaseUserId as string, options),
        activityLogService.getActivityCount(firebaseUserId as string, options),
      ]);

      ctx.body = {
        data: logs,
        meta: {
          total,
          page: options.page,
          pageSize: options.pageSize,
        },
      };
    } catch (error) {
      throw new errors.ApplicationError("Failed to fetch activity logs", {
        error: error.message,
      });
    }
  },
};

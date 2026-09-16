import activityLoggerFactory from "./activity-logger";
import adminLoginRateLimit from "./admin-login-rate-limit";

export default {
  "activity-logger": activityLoggerFactory,
  "admin-login-rate-limit": adminLoginRateLimit,
};

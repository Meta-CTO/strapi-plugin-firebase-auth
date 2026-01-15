import type { Core } from "@strapi/strapi";
import type Koa from "koa";

interface RouteConfig {
  path: string;
  method: string;
  action: string;
  type:
    | "authentication"
    | "tokenValidation"
    | "fieldUpdate"
    | "passwordReset"
    | "emailVerification"
    | "accountCreation"
    | "accountDeletion"
    | "adminAction";
}

// Routes to log
const LOGGED_ROUTES: RouteConfig[] = [
  { path: "/api/firebase-authentication", method: "POST", action: "tokenValidation", type: "authentication" },
  {
    path: "/api/firebase-authentication/emailLogin",
    method: "POST",
    action: "emailLogin",
    type: "authentication",
  },
  {
    path: "/api/firebase-authentication/forgotPassword",
    method: "POST",
    action: "forgotPassword",
    type: "passwordReset",
  },
  {
    path: "/api/firebase-authentication/resetPassword",
    method: "POST",
    action: "resetPassword",
    type: "passwordReset",
  },
  {
    path: "/api/firebase-authentication/resetPasswordWithToken",
    method: "POST",
    action: "resetPasswordWithToken",
    type: "passwordReset",
  },
  {
    path: "/api/firebase-authentication/sendVerificationEmail",
    method: "POST",
    action: "sendVerificationEmail",
    type: "emailVerification",
  },
  {
    path: "/api/firebase-authentication/verifyEmail",
    method: "POST",
    action: "verifyEmail",
    type: "emailVerification",
  },
  {
    path: "/api/firebase-authentication/requestMagicLink",
    method: "POST",
    action: "requestMagicLink",
    type: "authentication",
  },
];

// Type for response body
interface ResponseBody {
  user?: {
    uid?: string;
    firebaseUserID?: string;
  };
  uid?: string;
  error?: {
    message?: string;
  };
}

// Type for request body
interface RequestBody {
  uid?: string;
  email?: string;
}

/**
 * Extract Firebase User ID from context
 * Checks multiple sources in order of priority:
 * 1. Authenticated user (ctx.state.user) -> firebase_user_data lookup
 * 2. Response body user.uid or user.firebaseUserID
 * 3. Response body uid
 * 4. Request body uid
 * 5. Request body email -> user lookup -> firebase_user_data lookup
 */
async function extractFirebaseUserId(ctx: Koa.Context, strapi: Core.Strapi): Promise<string | null> {
  // 1. From authenticated user - fetch firebase_user_data relation
  const stateUser = ctx.state?.user as { documentId?: string } | undefined;
  if (stateUser?.documentId) {
    try {
      const firebaseData = await strapi
        .documents("plugin::firebase-authentication.firebase-user-data")
        .findFirst({
          filters: { user: { documentId: { $eq: stateUser.documentId } } },
          fields: ["firebaseUserID"],
        });
      if (firebaseData?.firebaseUserID) {
        return firebaseData.firebaseUserID;
      }
    } catch (err) {
      strapi.log.warn("[Activity Logger] Failed to fetch firebase_user_data:", err);
    }
  }

  // 2. From response body (login/token validation returns user.uid or firebaseUserID)
  const body = ctx.body as ResponseBody | undefined;
  if (body?.user?.uid) {
    return body.user.uid;
  }

  if (body?.user?.firebaseUserID) {
    return body.user.firebaseUserID;
  }

  // 3. From response body (some endpoints return just uid)
  if (body?.uid) {
    return body.uid;
  }

  // 4. From request body (for endpoints that receive the uid in the request)
  const reqBody = ctx.request?.body as RequestBody | undefined;
  if (reqBody?.uid) {
    return reqBody.uid;
  }

  // 5. From request body email - lookup user and get firebase_user_data
  if (reqBody?.email) {
    try {
      const user = await strapi.documents("plugin::users-permissions.user").findFirst({
        filters: { email: { $eq: reqBody.email } },
        fields: ["documentId"],
      });
      if (user?.documentId) {
        const firebaseData = await strapi
          .documents("plugin::firebase-authentication.firebase-user-data")
          .findFirst({
            filters: { user: { documentId: { $eq: user.documentId } } },
            fields: ["firebaseUserID"],
          });
        if (firebaseData?.firebaseUserID) {
          return firebaseData.firebaseUserID;
        }
      }
    } catch (err) {
      strapi.log.warn("[Activity Logger] Failed to lookup user by email:", err);
    }
  }

  return null;
}

/**
 * Get client IP address from request
 */
function getClientIP(ctx: Koa.Context): string {
  const forwardedFor = ctx.request.headers["x-forwarded-for"];
  if (forwardedFor) {
    return (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor).split(",")[0].trim();
  }

  const realIP = ctx.request.headers["x-real-ip"];
  if (realIP) {
    return Array.isArray(realIP) ? realIP[0] : realIP;
  }

  return ctx.request.ip || "unknown";
}

/**
 * Factory function that creates the activity logger middleware
 */
export default ({ strapi }: { strapi: Core.Strapi }) => {
  strapi.log.info("[Activity Logger] Middleware registered");

  return async (ctx: Koa.Context, next: Koa.Next) => {
    const startTime = Date.now();

    // Execute the request handler first
    await next();

    // After request completes, check if this route should be logged
    const routeConfig = LOGGED_ROUTES.find((r) => ctx.path === r.path && ctx.method === r.method);

    if (!routeConfig) {
      return;
    }

    // Capture values needed for logging before the IIFE
    // (In Koa, code after await next() runs before response is sent)
    const status = ctx.status;
    const body = ctx.body;
    const path = ctx.path;
    const method = ctx.method;
    const stateUser = ctx.state?.user as { documentId?: string } | undefined;
    const userAgent = ctx.request.headers["user-agent"];
    const clientIP = getClientIP(ctx);

    // Fire-and-forget: Don't block response for logging (async DB queries)
    (async () => {
      try {
        const firebaseUserId = await extractFirebaseUserId(ctx, strapi);
        if (!firebaseUserId) {
          return;
        }

        await strapi
          .plugin("firebase-authentication")
          .service("activityLogService")
          .logActivity({
            firebaseUserId,
            strapiUserId: stateUser?.documentId,
            activityType: routeConfig.type,
            action: routeConfig.action,
            endpoint: path,
            method: method,
            ipAddress: clientIP,
            userAgent: userAgent,
            success: status >= 200 && status < 400,
            errorMessage: status >= 400 ? (body as ResponseBody)?.error?.message : undefined,
            metadata: {
              responseTime: Date.now() - startTime,
              statusCode: status,
              responseBody: body,
            },
          });
      } catch (err) {
        strapi.log.error("[Activity Logger] Failed to log activity:", err);
      }
    })();
  };
};

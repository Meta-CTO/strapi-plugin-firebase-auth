// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const strapi: any;
import { Context } from "koa";
import { pluginName } from "../firebaseAuthentication/types";
import { ERROR_MESSAGES } from "../constants";

const firebaseController = {
  async validateToken(ctx) {
    strapi.log.debug("validateToken called");
    try {
      const { idToken, profileMetaData } = ctx.request.body || {};
      const populate = ctx.request.query.populate || [];

      if (!idToken) {
        return ctx.badRequest(ERROR_MESSAGES.TOKEN_MISSING);
      }

      const result = await strapi
        .plugin(pluginName)
        .service("firebaseService")
        .validateFirebaseToken(idToken, profileMetaData, populate);

      ctx.body = result;
    } catch (error) {
      strapi.log.error(`validateToken controller error: ${error.message}`);
      if (error.name === "ValidationError") {
        return ctx.badRequest(error.message);
      }
      if (error.name === "UnauthorizedError") {
        return ctx.unauthorized(error.message);
      }
      throw error;
    }
  },

  async deleteByEmail(email) {
    const user = await strapi.firebase.auth().getUserByEmail(email);
    await strapi.plugin(pluginName).service("firebaseService").delete(user.toJSON().uid);
    return user.toJSON();
  },

  async overrideAccess(ctx) {
    try {
      const { overrideUserId } = ctx.request.body || {};
      const populate = ctx.request.query.populate || [];

      const result = await strapi
        .plugin(pluginName)
        .service("firebaseService")
        .overrideFirebaseAccess(overrideUserId, populate);

      ctx.body = result;
    } catch (error) {
      if (error.name === "ValidationError") {
        return ctx.badRequest(error.message);
      }
      if (error.name === "NotFoundError") {
        return ctx.notFound(error.message);
      }
      throw error;
    }
  },

  /**
   * Controller method for email/password authentication
   * Handles the `/api/firebase-authentication/emailLogin` endpoint
   *
   * @param ctx - Koa context object
   * @returns Promise that sets ctx.body with user data and JWT or error message
   *
   * @remarks
   * This controller acts as a proxy to Firebase's Identity Toolkit API,
   * allowing users to authenticate with email/password and receive a Strapi JWT.
   *
   * HTTP Status Codes:
   * - `400`: Validation errors (missing credentials, invalid email/password)
   * - `500`: Server errors (missing configuration, Firebase API issues)
   */
  async emailLogin(ctx) {
    strapi.log.debug("emailLogin controller");
    try {
      const { email, password } = ctx.request.body || {};
      const populate = ctx.request.query.populate || [];

      const result = await strapi
        .plugin(pluginName)
        .service("firebaseService")
        .emailLogin(email, password, populate);

      ctx.body = result;
    } catch (error) {
      strapi.log.error("emailLogin controller error:", error);
      // Set appropriate status code for different error types
      if (error.name === "ValidationError") {
        ctx.status = 400;
      } else if (error.name === "ApplicationError") {
        ctx.status = 500;
      } else {
        ctx.status = 500;
      }
      ctx.body = { error: error.message };
    }
  },

  /**
   * Forgot password - sends reset email
   * POST /api/firebase-authentication/forgotPassword
   * Public endpoint - no authentication required
   */
  async forgotPassword(ctx) {
    strapi.log.debug("forgotPassword endpoint called");
    try {
      const { email } = ctx.request.body || {};
      ctx.body = await strapi.plugin(pluginName).service("firebaseService").forgotPassword(email);
    } catch (error) {
      strapi.log.error("forgotPassword controller error:", error);
      if (error.name === "ValidationError") {
        ctx.status = 400;
      } else if (error.name === "NotFoundError") {
        ctx.status = 404;
      } else {
        ctx.status = 500;
      }
      ctx.body = { error: error.message };
    }
  },

  /**
   * Reset password - authenticated password change
   * POST /api/firebase-authentication/resetPassword
   * Public endpoint - requires valid JWT in Authorization header
   * Used for admin-initiated resets or user self-service password changes
   * NOT used for forgot password email flow (which uses Firebase's hosted UI)
   */
  async resetPassword(ctx) {
    strapi.log.debug("resetPassword endpoint called");
    try {
      const { password } = ctx.request.body || {};
      const token = ctx.request.headers.authorization?.replace("Bearer ", "");
      const populate = ctx.request.query.populate || [];

      ctx.body = await strapi
        .plugin(pluginName)
        .service("firebaseService")
        .resetPassword(password, token, populate);
    } catch (error) {
      strapi.log.error("resetPassword controller error:", error);
      if (error.name === "ValidationError" || error.name === "UnauthorizedError") {
        ctx.status = 401;
      } else {
        ctx.status = 500;
      }
      ctx.body = { error: error.message };
    }
  },

  async requestMagicLink(ctx: Context) {
    try {
      const { email } = ctx.request.body || {};

      const result = await strapi
        .plugin("firebase-authentication")
        .service("firebaseService")
        .requestMagicLink(email);

      ctx.body = result;
    } catch (error) {
      if (error.name === "ValidationError" || error.name === "ApplicationError") {
        throw error;
      }
      // Log internal errors but don't expose them
      strapi.log.error("requestMagicLink controller error:", error);
      ctx.body = {
        success: false,
        message: "An error occurred while processing your request",
      };
    }
  },

  /**
   * Reset password using custom JWT token
   * POST /api/firebase-authentication/resetPasswordWithToken
   * Public endpoint - token provides authentication
   *
   * @param ctx - Koa context with { token, newPassword } in body
   * @returns { success: true, message: "Password has been reset successfully" }
   */
  async resetPasswordWithToken(ctx: Context) {
    strapi.log.debug("resetPasswordWithToken endpoint called");
    try {
      const { token, newPassword } = (ctx.request.body as { token?: string; newPassword?: string }) || {};

      if (!token) {
        ctx.status = 400;
        ctx.body = { error: "Token is required" };
        return;
      }

      if (!newPassword) {
        ctx.status = 400;
        ctx.body = { error: "New password is required" };
        return;
      }

      const result = await strapi
        .plugin(pluginName)
        .service("userService")
        .resetPasswordWithToken(token, newPassword);

      ctx.body = result;
    } catch (error) {
      strapi.log.error("resetPasswordWithToken controller error:", error);

      if (error.name === "ValidationError") {
        ctx.status = 400;
        ctx.body = { error: error.message };
        return;
      }

      if (error.name === "NotFoundError") {
        ctx.status = 404;
        ctx.body = { error: error.message };
        return;
      }

      ctx.status = 500;
      ctx.body = { error: "An error occurred while resetting your password" };
    }
  },
};

export default firebaseController;

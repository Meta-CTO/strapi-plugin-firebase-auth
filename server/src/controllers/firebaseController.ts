// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const strapi: any;
import { Context } from "koa";
import { errors } from "@strapi/utils";
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
    try {
      const user = await strapi.firebase.auth().getUserByEmail(email);
      await strapi.plugin(pluginName).service("firebaseService").delete(user.toJSON().uid);
      return user.toJSON();
    } catch (error) {
      strapi.log.error("deleteByEmail error:", error);
      throw error;
    }
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
      throw error;
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
      throw error;
    }
  },

  /**
   * Reset password - authenticated password change
   * POST /api/firebase-authentication/resetPassword
   * Authenticated endpoint - requires valid JWT (enforced by is-authenticated policy)
   * Used for admin-initiated resets or user self-service password changes
   * NOT used for forgot password email flow (which uses Firebase's hosted UI)
   */
  async resetPassword(ctx) {
    strapi.log.debug("resetPassword endpoint called");
    try {
      const { password } = ctx.request.body || {};
      const user = ctx.state.user; // User populated by is-authenticated policy
      const populate = ctx.request.query.populate || [];

      ctx.body = await strapi
        .plugin(pluginName)
        .service("firebaseService")
        .resetPassword(password, user, populate);
    } catch (error) {
      strapi.log.error("resetPassword controller error:", error);
      throw error;
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
        throw new errors.ValidationError("Token is required");
      }

      if (!newPassword) {
        throw new errors.ValidationError("New password is required");
      }

      const result = await strapi
        .plugin(pluginName)
        .service("userService")
        .resetPasswordWithToken(token, newPassword);

      ctx.body = result;
    } catch (error) {
      strapi.log.error("resetPasswordWithToken controller error:", error);
      throw error;
    }
  },

  /**
   * Send email verification - public endpoint
   * POST /api/firebase-authentication/sendVerificationEmail
   * Authenticated endpoint - sends verification email to the logged-in user's email
   */
  async sendVerificationEmail(ctx: Context) {
    strapi.log.debug("sendVerificationEmail endpoint called");
    try {
      const user = ctx.state.user;
      const email = user.email; // Use authenticated user's email for security
      ctx.body = await strapi.plugin(pluginName).service("firebaseService").sendVerificationEmail(email);
    } catch (error) {
      strapi.log.error("sendVerificationEmail controller error:", error);
      throw error;
    }
  },

  /**
   * Verify email using custom JWT token
   * POST /api/firebase-authentication/verifyEmail
   * Public endpoint - token provides authentication
   *
   * @param ctx - Koa context with { token } in body
   * @returns { success: true, message: "Email verified successfully" }
   */
  async verifyEmail(ctx: Context) {
    strapi.log.debug("verifyEmail endpoint called");
    try {
      const { token } = (ctx.request.body as { token?: string }) || {};

      if (!token) {
        return ctx.badRequest("Token is required");
      }

      const result = await strapi.plugin(pluginName).service("firebaseService").verifyEmail(token);

      ctx.body = result;
    } catch (error) {
      strapi.log.error("verifyEmail controller error:", error);
      if (error.name === "ValidationError") {
        return ctx.badRequest(error.message);
      }
      throw error;
    }
  },
};

export default firebaseController;

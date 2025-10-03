// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const strapi: any;
import { pluginName } from "../firebaseAuthentication/types";

const firebaseController = {
  async validateToken(ctx) {
    console.log("validateToken 🤣");
    ctx.body = await strapi.plugin(pluginName).service("firebaseService").validateFirebaseToken(ctx);
  },

  async createAlias(ctx) {
    ctx.body = await strapi.plugin(pluginName).service("firebaseService").createAlias(ctx);
  },

  async deleteByEmail(email) {
    const user = await strapi.firebase.auth().getUserByEmail(email);
    await strapi.plugin(pluginName).service("firebaseService").delete(user.toJSON().uid);
    return user.toJSON();
  },

  async overrideAccess(ctx) {
    ctx.body = await strapi.plugin(pluginName).service("firebaseService").overrideFirebaseAccess(ctx);
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
    console.log("emailLogin controller");
    try {
      ctx.body = await strapi.plugin(pluginName).service("firebaseService").emailLogin(ctx);
    } catch (error) {
      console.error("emailLogin controller error:", error);
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
};

export default firebaseController;

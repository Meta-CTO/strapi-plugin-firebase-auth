import { errors } from "@strapi/utils";

import { Context, DefaultContext } from "koa";

const STRAPI_DESTINATION = "strapi";
const FIREBASE_DESTINATION = "firebase";

export default {
  list: async (ctx: DefaultContext | Context) => {
    let { pagination, nextPageToken, sort, search } = ctx.query;

    if (!pagination) {
      pagination = {};
      pagination.page = 1;
      pagination.pageSize = 10;
    }

    ctx.body = await strapi
      .plugin("firebase-authentication")
      .service("userService")
      .list(pagination, nextPageToken, sort, search);
  },

  create: async (ctx) => {
    ctx.body = await strapi.plugin("firebase-authentication").service("userService").create(ctx.request.body);
  },

  get: async (ctx) => {
    ctx.body = await strapi.plugin("firebase-authentication").service("userService").get(ctx.params.id);
  },

  update: async (ctx) => {
    ctx.body = await strapi
      .plugin("firebase-authentication")
      .service("userService")
      .update(ctx.params.id, ctx.request.body);
  },

  delete: async (ctx: DefaultContext | Context) => {
    const { destination } = ctx.request.query;
    switch (destination) {
      case STRAPI_DESTINATION:
        ctx.body = await strapi
          .plugin("firebase-authentication")
          .service("userService")
          .deleteStrapiUser(ctx.params.id);
        break;
      case FIREBASE_DESTINATION:
        ctx.body = await strapi
          .plugin("firebase-authentication")
          .service("userService")
          .deleteFirebaseUser(ctx.params.id);
        break;
      default:
        ctx.body = await strapi
          .plugin("firebase-authentication")
          .service("userService")
          .delete(ctx.params.id);
        break;
    }
  },

  deleteMany: async (ctx) => {
    ctx.body = await strapi
      .plugin("firebase-authentication")
      .service("userService")
      .deleteMany(ctx.query.ids);
  },
  resetPassword: async (ctx) => {
    const { destination } = ctx.request.query;
    const { password } = ctx.request.body;

    // Fetch password configuration from database
    const configObject = await strapi.db
      .query("plugin::firebase-authentication.firebase-authentication-configuration")
      .findOne({ where: {} });

    // Use config values or simple defaults
    const passwordRegex = configObject?.passwordRequirementsRegex || "^.{6,}$";
    const passwordMessage =
      configObject?.passwordRequirementsMessage || "Password must be at least 6 characters long";

    // Validate password using dynamic config
    if (!password) {
      throw new errors.ValidationError("Password is required");
    }

    try {
      const regex = new RegExp(passwordRegex);
      if (!regex.test(password)) {
        throw new errors.ValidationError(passwordMessage);
      }
    } catch (e) {
      // If regex is invalid, fall back to length check
      if (password.length < 6) {
        throw new errors.ValidationError("Password must be at least 6 characters long");
      }
    }

    switch (destination) {
      case STRAPI_DESTINATION:
        ctx.body = await strapi
          .plugin("firebase-authentication")
          .service("userService")
          .resetPasswordStrapiUser(ctx.params.id, {
            password: ctx.request.body.password,
          });
        break;
      case FIREBASE_DESTINATION:
        ctx.body = await strapi
          .plugin("firebase-authentication")
          .service("userService")
          .resetPasswordFirebaseUser(ctx.params.id, {
            password: ctx.request.body.password,
          });
        break;
      default:
        ctx.body = await strapi
          .plugin("firebase-authentication")
          .service("userService")
          .resetPassword(ctx.params.id, {
            password: ctx.request.body.password,
          });
        break;
    }
  },

  sendResetEmail: async (ctx) => {
    const userId = ctx.params.id;

    if (!userId) {
      throw new errors.ValidationError("User ID is required");
    }

    try {
      ctx.body = await strapi
        .plugin("firebase-authentication")
        .service("userService")
        .sendPasswordResetEmail(userId);
    } catch (error) {
      throw new errors.ApplicationError(error.message || "Failed to send password reset email");
    }
  },

  sendVerificationEmail: async (ctx) => {
    const userId = ctx.params.id;

    if (!userId) {
      throw new errors.ValidationError("User ID is required");
    }

    try {
      ctx.body = await strapi
        .plugin("firebase-authentication")
        .service("userService")
        .sendVerificationEmail(userId);
    } catch (error) {
      throw new errors.ApplicationError(error.message || "Failed to send verification email");
    }
  },
};

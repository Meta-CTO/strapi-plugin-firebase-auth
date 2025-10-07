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
    if (!ctx.request.body.password || ctx.request.body.password.length < 6) {
      throw new errors.ValidationError("Password maybe empty or less than 6");
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
};

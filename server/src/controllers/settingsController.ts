import {errors} from '@strapi/utils';
import { Context, DefaultContext } from "koa";


export default {
  setToken: async (ctx: DefaultContext | Context) => {
    ctx.body = await strapi
      .plugin("firebase-auth")
      .service("settingsService")
      .setToken(ctx);
  },
  setFirebaseConfigJson: async (ctx: DefaultContext | Context) => {
    ctx.body = await strapi
      .plugin("firebase-auth")
      .service("settingsService")
      .setFirebaseConfigJson(ctx);
  },
  getFirebaseConfigJson: async (ctx: DefaultContext | Context) => {
    try {
      const config = await strapi
        .plugin("firebase-auth")
        .service("settingsService")
        .getFirebaseConfigJson(ctx);

      if (!config) {
        return ctx.send(null);
      }

      ctx.body = config;
    } catch (error) {
      throw new errors.ApplicationError("Error retrieving Firebase config", {
        error: error.message,
      });
    }
  },
  async delFirebaseConfigJson(ctx: DefaultContext | Context) {
    try {
      const isExist = await strapi
        .plugin("firebase-auth")
        .service("settingsService")
        .delFirebaseConfigJson(ctx);
      if (!isExist) {
        throw new errors.NotFoundError('No Firebase configs exists for deletion');
      }
      ctx.body = isExist;
    } catch (error) {
      if (error.name === 'NotFoundError') {
        throw error;
      }
      throw new errors.ApplicationError('Error deleting Firebase config');
    }
  },
  async restart(ctx: DefaultContext | Context) {
    try {
      await strapi.plugin("firebase-auth").service("settingsService").restart();
      return ctx.send({ status: 200 });
    } catch (e) {
      throw new errors.ApplicationError(
        "some thing went wrong with restarting the server",
        { error: e.message },
      );
    }
  },
};

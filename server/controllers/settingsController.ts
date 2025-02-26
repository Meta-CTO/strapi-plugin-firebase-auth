
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
    const config = await strapi
      .plugin("firebase-auth")
      .service("settingsService")
      .getFirebaseConfigJson(ctx);

    if (!config || !config.firebaseConfigJson) {
      ctx.notFound("no firebase config Found");
      return;
    }
    ctx.body = config;
  },
  async delFirebaseConfigJson(ctx: DefaultContext | Context) {
    const isExist = await strapi
      .plugin("firebase-auth")
      .service("settingsService")
      .delFirebaseConfigJson(ctx);
    if (!isExist) {
      ctx.notFound("No Firebase configs Exists for deletion");
    } else {
      ctx.body = isExist;
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

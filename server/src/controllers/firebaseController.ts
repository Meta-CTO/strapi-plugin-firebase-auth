// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const strapi: any;
import { pluginName } from "../firebaseAuth/types";

const firebaseController = {

  async validateToken(ctx) {
    console.log("validateToken 🤣");
    ctx.body = await strapi
      .plugin(pluginName)
      .service("firebaseService")
      .validateFirebaseToken(ctx);
  },

  async createAlias(ctx) {
    ctx.body = await strapi
      .plugin(pluginName)
      .service("firebaseService")
      .createAlias(ctx);
  },

  async deleteByEmail(email) {
    const user = await strapi.firebase.auth().getUserByEmail(email);
    await strapi
      .plugin(pluginName)
      .service("firebaseService")
      .delete(user.toJSON().uid);
    return user.toJSON();
  },

  async overrideAccess(ctx) {
    ctx.body = await strapi
      .plugin(pluginName)
      .service("firebaseService")
      .overrideFirebaseAccess(ctx);
  },
};

export default firebaseController;

import type { Core } from '@strapi/strapi';
import type { FirebaseAuthController } from '../types';

export default ({ strapi }: FirebaseAuthController) => ({

  async overrideAccess(ctx) {
    ctx.body = await strapi
      .plugin("firebase-auth")
      .service("firebaseService")
      .overrideFirebaseAccess(ctx);
  },

  async validateToken(ctx) {
    ctx.body = await strapi
      .plugin("firebase-auth")
      .service("firebaseService")
      .validateFirebaseToken(ctx);
  },
  
  exchangeToken: async (ctx) => {
    try {
      const { idToken } = ctx.request.body;

      // Validate and decode the Firebase token
      const decodedToken = await strapi
        .plugin('firebase-auth')
        .service('firebase')
        .validateToken(idToken);

      // Find or create user
      let user = await strapi
        .plugin('firebase-auth')
        .service('firebase')
        .findUser(decodedToken);

      if (!user) {
        user = await strapi
          .plugin('firebase-auth')
          .service('firebase')
          .createUser(decodedToken);
      }

      // Generate Strapi JWT
      const jwt = await strapi
        .plugin('firebase-auth')
        .service('firebase')
        .generateJWT(user);

      ctx.body = {
        jwt,
        user: {
          id: user.id,
          email: user.email,
          username: user.username
        }
      };
    } catch (error) {
      ctx.throw(401, error.message);
    }
  }
}); 
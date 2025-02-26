
import { errors } from '@strapi/utils';
const { ValidationError } = errors;
import type { Core } from '@strapi/strapi';

interface FirebaseAuthService {
  strapi: Core.Strapi;
}

export default ({ strapi }: FirebaseAuthService) => ({
  validateToken: async (idToken: string) => {
    if (!idToken) {
      throw new ValidationError('Firebase ID token is required');
    }

    try {
      return await strapi.firebase.auth().verifyIdToken(idToken);
    } catch (error) {
      throw new ValidationError('Invalid Firebase token');
    }
  },

  findUser: async (decodedToken: any) => {
    // First try to find by firebaseUID
    const userByFirebaseId = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { firebaseUserID: decodedToken.uid }
    });

    if (userByFirebaseId) {
      return userByFirebaseId;
    }

    // Then try email/phone
    const query = {
      $or: [] as any[]
    };

    if (decodedToken.email) {
      query.$or.push({ email: decodedToken.email });
    }

    if (decodedToken.phone_number) {
      query.$or.push({ phoneNumber: decodedToken.phone_number });
    }

    if (query.$or.length === 0) {
      return null;
    }

    return strapi.db.query('plugin::users-permissions.user').findOne({
      where: query
    });
  },

  createUser: async (decodedToken: any) => {
    const pluginStore = await strapi.store({
      environment: '',
      type: 'plugin',
      name: 'users-permissions'
    });

    const settings = await pluginStore.get({ key: 'advanced' });
    const defaultRole = await strapi.db.query('plugin::users-permissions.role')
      .findOne({ where: { type: settings.default_role } });

    const userData = {
      firebaseUserID: decodedToken.uid,
      email: decodedToken.email,
      username: decodedToken.email ? decodedToken.email.split('@')[0] : decodedToken.uid,
      phoneNumber: decodedToken.phone_number,
      confirmed: true,
      role: defaultRole.id,
      provider: 'firebase'
    };

    return strapi.db.query('plugin::users-permissions.user').create({
      data: userData
    });
  },

  generateJWT: async (user: any) => {
    return strapi.plugins['users-permissions'].services.jwt.issue({
      id: user.id
    });
  }
}); 
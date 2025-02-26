import * as admin from 'firebase-admin';
import type { Core } from '@strapi/strapi';

export default async ({ strapi }: { strapi: Core.Strapi }) => {
  try {
    // Get config from content type
    const config = await strapi.db
      .query('plugin::firebase-auth.firebase-auth-configuration')
      .findOne({ where: {} });

    if (!config?.firebase_config_json) {
      strapi.log.error('Firebase configuration not found');
      return;
    }

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(config.firebase_config_json),
      });
    }

    // Attach firebase-admin to strapi instance
    strapi.firebase = admin;
    
    // Initialize settings
    await strapi.plugin("firebase-auth").service("settingsService").init();
  } catch (error) {
    strapi.log.error('Firebase Auth plugin bootstrap error:', error);
  }
};


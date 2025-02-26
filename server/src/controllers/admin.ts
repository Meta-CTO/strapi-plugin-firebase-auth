import type { Core } from '@strapi/strapi';
import type { AdminController } from '../types';

export default ({ strapi }: AdminController) => ({
  async getConfig(ctx) {
    const config = await strapi.db
      .query('plugin::firebase-auth.firebase-auth-configuration')
      .findOne({ where: {} });
    
    ctx.body = config;
  },

  async updateConfig(ctx) {
    const { firebase_config_json } = ctx.request.body;

    const existingConfig = await strapi.db
      .query('plugin::firebase-auth.firebase-auth-configuration')
      .findOne({ where: {} });

    if (existingConfig) {
      const config = await strapi.db
        .query('plugin::firebase-auth.firebase-auth-configuration')
        .update({
          where: { id: existingConfig.id },
          data: { firebase_config_json },
        });
      ctx.body = config;
    } else {
      const config = await strapi.db
        .query('plugin::firebase-auth.firebase-auth-configuration')
        .create({
          data: { firebase_config_json },
        });
      ctx.body = config;
    }
  },
}); 
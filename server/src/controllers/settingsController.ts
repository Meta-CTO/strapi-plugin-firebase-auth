import { errors } from "@strapi/utils";
import { Context, DefaultContext } from "koa";

export default {
  setFirebaseConfigJson: async (ctx: DefaultContext | Context) => {
    const requestBody = ctx.request.body;
    ctx.body = await strapi
      .plugin("firebase-authentication")
      .service("settingsService")
      .setFirebaseConfigJson(requestBody);
  },
  getFirebaseConfigJson: async (ctx: DefaultContext | Context) => {
    try {
      const config = await strapi
        .plugin("firebase-authentication")
        .service("settingsService")
        .getFirebaseConfigJson();

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
        .plugin("firebase-authentication")
        .service("settingsService")
        .delFirebaseConfigJson();
      if (!isExist) {
        throw new errors.NotFoundError("No Firebase configs exists for deletion");
      }
      ctx.body = isExist;
    } catch (error) {
      if (error.name === "NotFoundError") {
        throw error;
      }
      throw new errors.ApplicationError("Error deleting Firebase config");
    }
  },
  async restart(ctx: DefaultContext | Context) {
    try {
      await strapi.plugin("firebase-authentication").service("settingsService").restart();
      return ctx.send({ status: 200 });
    } catch (e) {
      throw new errors.ApplicationError("some thing went wrong with restarting the server", {
        error: e.message,
      });
    }
  },
  async getPublicConfig(ctx: DefaultContext | Context) {
    try {
      const configObject = await strapi.db
        .query("plugin::firebase-authentication.firebase-authentication-configuration")
        .findOne({ where: {} });

      if (!configObject) {
        // Return default values if no configuration exists
        return ctx.send({
          passwordRequirementsRegex: "^.{6,}$",
          passwordRequirementsMessage: "Password must be at least 6 characters long",
          passwordResetUrl: "http://localhost:3000/reset-password",
          passwordResetEmailSubject: "Reset Your Password",
          isMagicLinkEnabled: false,
          firebaseConfig: null,
        });
      }

      // Prepare Firebase client configuration (safe for public exposure)
      let firebaseConfig = null;
      if (configObject.firebaseWebApiKey && configObject.firebaseConfigJson) {
        try {
          // Get the decrypted Firebase config to extract project details
          const settingsService = strapi.plugin("firebase-authentication").service("settingsService");
          const decryptedConfig = await settingsService.getFirebaseConfigJson();

          if (decryptedConfig && decryptedConfig.project_id) {
            firebaseConfig = {
              apiKey: configObject.firebaseWebApiKey,
              authDomain: `${decryptedConfig.project_id}.firebaseapp.com`,
              projectId: decryptedConfig.project_id,
              // Add other public config as needed, but never expose private keys
            };
          }
        } catch (decryptError) {
          strapi.log.warn("Could not prepare Firebase client config:", decryptError);
        }
      }

      // Return public configuration fields (no sensitive data)
      ctx.body = {
        passwordRequirementsRegex: configObject.passwordRequirementsRegex || "^.{6,}$",
        passwordRequirementsMessage:
          configObject.passwordRequirementsMessage || "Password must be at least 6 characters long",
        passwordResetUrl: configObject.passwordResetUrl || "http://localhost:3000/reset-password",
        passwordResetEmailSubject: configObject.passwordResetEmailSubject || "Reset Your Password",
        isMagicLinkEnabled: configObject.enableMagicLink || false,
        magicLinkUrl: configObject.magicLinkUrl || "http://localhost:1338/verify-magic-link.html",
        magicLinkEmailSubject: configObject.magicLinkEmailSubject || "Sign in to Your Application",
        magicLinkExpiryHours: configObject.magicLinkExpiryHours || 1,
        firebaseConfig,
      };
    } catch (error) {
      throw new errors.ApplicationError("Error retrieving public configuration", {
        error: error.message,
      });
    }
  },
  async savePasswordConfig(ctx: DefaultContext | Context) {
    try {
      const { body: requestBody } = ctx.request;
      const {
        passwordRequirementsRegex = "^.{6,}$",
        passwordRequirementsMessage = "Password must be at least 6 characters long",
        passwordResetUrl = "http://localhost:3000/reset-password",
        passwordResetEmailSubject = "Reset Your Password",
        enableMagicLink = false,
        magicLinkUrl = "http://localhost:1338/verify-magic-link.html",
        magicLinkEmailSubject = "Sign in to Your Application",
        magicLinkExpiryHours = 1,
      } = requestBody;

      // Check if configuration exists
      const existingConfig = await strapi.db
        .query("plugin::firebase-authentication.firebase-authentication-configuration")
        .findOne({ where: {} });

      let result;
      if (!existingConfig) {
        // Create new configuration with password and magic link settings
        result = await strapi.db
          .query("plugin::firebase-authentication.firebase-authentication-configuration")
          .create({
            data: {
              passwordRequirementsRegex,
              passwordRequirementsMessage,
              passwordResetUrl,
              passwordResetEmailSubject,
              enableMagicLink,
              magicLinkUrl,
              magicLinkEmailSubject,
              magicLinkExpiryHours,
            },
          });
      } else {
        // Update existing configuration
        result = await strapi.db
          .query("plugin::firebase-authentication.firebase-authentication-configuration")
          .update({
            where: { id: existingConfig.id },
            data: {
              passwordRequirementsRegex,
              passwordRequirementsMessage,
              passwordResetUrl,
              passwordResetEmailSubject,
              enableMagicLink,
              magicLinkUrl,
              magicLinkEmailSubject,
              magicLinkExpiryHours,
            },
          });
      }

      ctx.body = {
        passwordRequirementsRegex: result.passwordRequirementsRegex,
        passwordRequirementsMessage: result.passwordRequirementsMessage,
        passwordResetUrl: result.passwordResetUrl,
        passwordResetEmailSubject: result.passwordResetEmailSubject,
        enableMagicLink: result.enableMagicLink,
        magicLinkUrl: result.magicLinkUrl,
        magicLinkEmailSubject: result.magicLinkEmailSubject,
        magicLinkExpiryHours: result.magicLinkExpiryHours,
      };
    } catch (error) {
      throw new errors.ApplicationError("Error saving password configuration", {
        error: error.message,
      });
    }
  },
};

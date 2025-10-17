import { errors } from "@strapi/utils";
import { Context, DefaultContext } from "koa";

export default {
  setToken: async (ctx: DefaultContext | Context) => {
    ctx.body = await strapi.plugin("firebase-authentication").service("settingsService").setToken(ctx);
  },
  setFirebaseConfigJson: async (ctx: DefaultContext | Context) => {
    ctx.body = await strapi
      .plugin("firebase-authentication")
      .service("settingsService")
      .setFirebaseConfigJson(ctx);
  },
  getFirebaseConfigJson: async (ctx: DefaultContext | Context) => {
    try {
      const config = await strapi
        .plugin("firebase-authentication")
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
        .plugin("firebase-authentication")
        .service("settingsService")
        .delFirebaseConfigJson(ctx);
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
        });
      }

      // Return public configuration fields (no sensitive data)
      ctx.body = {
        passwordRequirementsRegex: configObject.passwordRequirementsRegex || "^.{6,}$",
        passwordRequirementsMessage: configObject.passwordRequirementsMessage || "Password must be at least 6 characters long",
        passwordResetUrl: configObject.passwordResetUrl || "http://localhost:3000/reset-password",
        passwordResetEmailSubject: configObject.passwordResetEmailSubject || "Reset Your Password",
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
      } = requestBody;

      // Check if configuration exists
      const existingConfig = await strapi.db
        .query("plugin::firebase-authentication.firebase-authentication-configuration")
        .findOne({ where: {} });

      let result;
      if (!existingConfig) {
        // Create new configuration with just password settings
        result = await strapi.db
          .query("plugin::firebase-authentication.firebase-authentication-configuration")
          .create({
            data: {
              passwordRequirementsRegex,
              passwordRequirementsMessage,
              passwordResetUrl,
              passwordResetEmailSubject,
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
            },
          });
      }

      ctx.body = {
        passwordRequirementsRegex: result.passwordRequirementsRegex,
        passwordRequirementsMessage: result.passwordRequirementsMessage,
        passwordResetUrl: result.passwordResetUrl,
        passwordResetEmailSubject: result.passwordResetEmailSubject,
      };
    } catch (error) {
      throw new errors.ApplicationError("Error saving password configuration", {
        error: error.message,
      });
    }
  },
};

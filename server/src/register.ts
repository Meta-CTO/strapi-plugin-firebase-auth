import type { Core } from "@strapi/strapi";
import type { FirebaseAuthConfig } from "./config";
import { pluginName } from "./firebaseAuthentication/types";
import middlewares from "./middlewares";

const register = ({ strapi }: { strapi: Core.Strapi }) => {
  strapi.log.info("Firebase Auth Plugin registered");
  const config: FirebaseAuthConfig = strapi.config.get("plugin::firebase-authentication");

  // Register activity logging middleware (factory pattern - pass strapi)
  strapi.server.use(middlewares["activity-logger"]({ strapi }));
};

export default register;

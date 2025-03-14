import type { Core } from "@strapi/strapi";
import type { FirebaseAuthConfig } from "./config";
import { pluginName } from "./firebaseAuthentication/types";

const register = ({ strapi }: { strapi: Core.Strapi }) => {
  strapi.log.info("Firebase Auth Plugin registered");
  const config: FirebaseAuthConfig = strapi.config.get("plugin::firebase-authentication");
};

export default register;

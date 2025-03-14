/**
 *  service
 */

import { factories } from "@strapi/strapi";

export default factories.createCoreService(
  "plugin::firebase-authentication.firebase-authentication-configuration"
);

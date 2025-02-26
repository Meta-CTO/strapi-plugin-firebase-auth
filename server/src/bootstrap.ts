import type { Core } from "@strapi/strapi";

const bootstrap = async ({ strapi }: { strapi: Core.Strapi }) => {
  // Register permission actions.
  const actions = [
    {
      section: "plugins",
      displayName: "Allow access to the Firebase Auth interface",
      uid: "menu-link",
      pluginName: "firebase-auth",
    },
  ];
  await strapi.plugin("firebase-auth").service("settingsService").init();
  await strapi.admin.services.permission.actionProvider.registerMany(actions);
};

export default bootstrap;

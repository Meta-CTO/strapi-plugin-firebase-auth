import type { Core } from "@strapi/strapi";

const bootstrap = async ({ strapi }: { strapi: Core.Strapi }) => {
  // Register permission actions.
  const actions = [
    {
      section: "plugins",
      displayName: "Allow access to the Firebase Auth interface",
      uid: "menu-link",
      pluginName: "firebase-authentication",
    },
  ];

  await strapi.plugin("firebase-authentication").service("settingsService").init();
  await strapi.admin.services.permission.actionProvider.registerMany(actions);

  // Register content-api permissions for public access
  if (strapi.plugin('users-permissions')) {
    const userPermissionsService = strapi.plugin('users-permissions').service('users-permissions');

    // Register firebase-authentication content-api routes
    userPermissionsService.initialize();
  }
};

export default bootstrap;

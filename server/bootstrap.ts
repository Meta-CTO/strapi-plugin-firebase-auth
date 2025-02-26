import { Core } from "@strapi/strapi";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async ({ strapi }: { strapi: Core.Strapi | any }) => {
  const RBAC_ACTIONS = [
    {
      section: "plugins",
      displayName: "Access firebase Auth Configurations",
      uid: "is-admin",
      pluginName: "firebase-auth",
    },
    {
      section: "settings",
      category: "Firebase Auth",
      displayName: "Firebase Auth: Read",
      uid: "settings.read",
      pluginName: "firebase-auth",
    },
  ];

  try {
    // Debug what plugins are available
    console.log('Available plugins:', Object.keys(strapi.plugins));
    
    // Debug the firebase-auth plugin
    const plugin = strapi.plugin("firebase-auth");
    console.log('Plugin exists:', !!plugin);
    
    if (plugin) {
      console.log('Available services:', Object.keys(plugin.services || {}));
    }

    await strapi.admin.services.permission.actionProvider.registerMany(
      RBAC_ACTIONS
    ).catch(error => {
      console.error('Permission Registration Error:', {
        name: error.name,
        message: error.message,
        details: error.details?.errors || error.details,
      });
      throw error;
    });

    await strapi.plugin("firebase-auth").service("settingsService").init();
  } catch (error) {
    console.error('Bootstrap Error:', {
      name: error.name,
      message: error.message,
      details: error.details?.errors || error.details,
    });
    throw error;
  }
};

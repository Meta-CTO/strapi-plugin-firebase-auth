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

  try {
    console.log("🔥 Firebase plugin bootstrap starting...");

    await strapi.plugin("firebase-authentication").service("settingsService").init();

    // @ts-ignore - firebase property is added dynamically
    if (strapi.firebase) {
      console.log("✅ Firebase successfully initialized");
      console.log("   - Admin SDK available at: strapi.firebase");
    } else {
      console.warn("⚠️  Firebase not initialized - no config found in database");
      console.warn("   - Upload Firebase service account JSON via plugin settings");
    }
  } catch (error) {
    console.error("❌ Firebase initialization failed during bootstrap:");
    console.error("   Error:", error.message);
    console.error("   Stack:", error.stack);
    // Don't throw - allow Strapi to start even if Firebase config not uploaded yet
  }

  await strapi.admin.services.permission.actionProvider.registerMany(actions);

  // Register content-api permissions for public access
  if (strapi.plugin('users-permissions')) {
    const userPermissionsService = strapi.plugin('users-permissions').service('users-permissions');

    // Register firebase-authentication content-api routes
    userPermissionsService.initialize();
  }
};

export default bootstrap;

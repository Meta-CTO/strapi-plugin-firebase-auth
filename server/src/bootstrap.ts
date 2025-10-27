import type { Core } from "@strapi/strapi";
import migrateFirebaseUserData from "./migrations/migrate-firebase-user-data";

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
    strapi.log.info("Firebase plugin bootstrap starting...");

    await strapi.plugin("firebase-authentication").service("settingsService").init();

    // @ts-ignore - firebase property is added dynamically
    if (strapi.firebase) {
      strapi.log.info("Firebase successfully initialized");
      strapi.log.info("   - Admin SDK available at: strapi.firebase");
    } else {
      strapi.log.warn("Firebase not initialized - no config found in database");
      strapi.log.warn("   - Upload Firebase service account JSON via plugin settings");
    }
  } catch (error) {
    strapi.log.error("Firebase initialization failed during bootstrap:");
    strapi.log.error("   Error:", error.message);
    strapi.log.error("   Stack:", error.stack);
    // Don't throw - allow Strapi to start even if Firebase config not uploaded yet
  }

  await strapi.admin.services.permission.actionProvider.registerMany(actions);

  // Register content-api permissions for public access
  if (strapi.plugin("users-permissions")) {
    const userPermissionsService = strapi.plugin("users-permissions").service("users-permissions");

    // Register firebase-authentication content-api routes
    userPermissionsService.initialize();
  }

  // TEMPORARY: Run Firebase user data migration on startup
  // Remove this after migration is complete in production
  if (process.env.RUN_FIREBASE_MIGRATION === "true") {
    const dryRun = process.env.DRY_RUN === "true";
    strapi.log.info("");
    strapi.log.info("🚀 Firebase migration triggered by RUN_FIREBASE_MIGRATION env variable");
    await migrateFirebaseUserData(strapi, dryRun);
  }

  // Auto-link Strapi users with Firebase users in the background
  // Runs on every startup (non-blocking)
  setImmediate(async () => {
    try {
      await strapi.plugin("firebase-authentication").service("autoLinkService").linkAllUsers(strapi);
    } catch (error) {
      strapi.log.error("Auto-linking failed:", error);
    }
  });
};

export default bootstrap;

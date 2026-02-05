import type { Core } from "@strapi/strapi";
import migrateFirebaseUserData from "./migrations/migrate-firebase-user-data";
import ensureUserLinkUniqueConstraint from "./migrations/ensure-user-link-unique-constraint";
import reportOrphanUsers from "./migrations/report-orphan-users";
import type { FirebaseAuthConfig } from "./config";

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
    strapi.log.error(`   Error: ${error.message}`);
    strapi.log.error(`   Stack: ${error.stack}`);
    // Don't throw - allow Strapi to start even if Firebase config not uploaded yet
  }

  await strapi.admin.services.permission.actionProvider.registerMany(actions);

  // Register content-api permissions for public access
  if (strapi.plugin("users-permissions")) {
    const userPermissionsService = strapi.plugin("users-permissions").service("users-permissions");

    // Register firebase-authentication content-api routes
    userPermissionsService.initialize();
  }

  // Run safe database migrations (idempotent, cannot delete data)
  try {
    await ensureUserLinkUniqueConstraint(strapi);
  } catch (error) {
    strapi.log.warn(`[Firebase Auth] Migration warning: ${error.message}`);
  }

  // TEMPORARY: Run Firebase user data migration on startup
  // Remove this after migration is complete in production
  if (process.env.RUN_FIREBASE_MIGRATION === "true") {
    const dryRun = process.env.DRY_RUN === "true";
    strapi.log.info("");
    strapi.log.info("Firebase migration triggered by RUN_FIREBASE_MIGRATION env variable");
    await migrateFirebaseUserData(strapi, dryRun);
  }

  // Auto-link Strapi users with Firebase users (OPT-IN)
  // Also runs orphan user report AFTER linking completes
  if (process.env.FIREBASE_AUTO_LINK_ON_STARTUP === "true") {
    setImmediate(async () => {
      try {
        strapi.log.info("[Firebase Auth] Auto-link enabled via FIREBASE_AUTO_LINK_ON_STARTUP");
        await strapi.plugin("firebase-authentication").service("autoLinkService").linkAllUsers(strapi);

        // Run orphan user report AFTER auto-link completes (READ-ONLY, does not delete)
        // Shows remaining orphan users that weren't auto-linked
        await reportOrphanUsers(strapi);
      } catch (error) {
        strapi.log.error(`Auto-linking failed: ${error.message}`);
      }
    });
  } else {
    strapi.log.debug(
      "[Firebase Auth] Startup auto-link disabled (set FIREBASE_AUTO_LINK_ON_STARTUP=true to enable)"
    );
  }

  // Activity log cleanup cron job (optional - based on env config)
  const pluginConfig: FirebaseAuthConfig = strapi.config.get("plugin::firebase-authentication");
  const retentionDays = pluginConfig?.activityLogRetentionDays;

  if (retentionDays && retentionDays > 0) {
    strapi.log.info(`[Firebase Auth] Activity log cleanup enabled: ${retentionDays} days retention`);

    strapi.cron.add({
      firebaseActivityLogCleanup: {
        task: async ({ strapi: strapiInstance }) => {
          try {
            const deleted = await strapiInstance
              .plugin("firebase-authentication")
              .service("activityLogService")
              .cleanupOldLogs(retentionDays);
            strapiInstance.log.info(`[Firebase Auth] Activity log cleanup: deleted ${deleted} old entries`);
          } catch (error) {
            strapiInstance.log.error("[Firebase Auth] Activity log cleanup failed:", error);
          }
        },
        options: {
          rule: "0 0 3 * * *", // Run daily at 3 AM
        },
      },
    });
  }
};

export default bootstrap;

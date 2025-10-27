import type { Core } from "@strapi/strapi";

interface UserWithFirebaseData {
  id: number;
  document_id: string;
  username: string;
  email: string;
  firebase_user_id?: string;
  apple_email?: string;
}

interface MigrationResult {
  totalUsers: number;
  usersWithFirebaseData: number;
  migrated: number;
  skipped: number;
  errors: Array<{ user: string; error: string }>;
}

/**
 * Migrate Firebase user data from up_users table to firebase_user_data table
 *
 * This script:
 * 1. Finds all users with Firebase data (firebaseUserID or appleEmail)
 * 2. Creates corresponding firebase_user_data records
 * 3. Skips users that already have firebase_user_data records
 * 4. Logs all operations for verification
 *
 * Note: idToken is NOT migrated (tokens expire in 1 hour, not needed)
 *
 * Run this script via:
 * yarn strapi migrate:firebase-user-data
 *
 * Or in development:
 * Call this function from bootstrap() temporarily
 */
async function migrateFirebaseUserData(
  strapi: Core.Strapi,
  dryRun: boolean = false
): Promise<MigrationResult> {
  strapi.log.info("=== Firebase User Data Migration ===");
  strapi.log.info(`Mode: ${dryRun ? "DRY RUN (no changes)" : "LIVE (will modify database)"}`);
  strapi.log.info("");

  const result: MigrationResult = {
    totalUsers: 0,
    usersWithFirebaseData: 0,
    migrated: 0,
    skipped: 0,
    errors: [],
  };

  try {
    // Step 1: Check if migration is needed (columns exist)
    strapi.log.info("Step 1: Checking if migration is needed...");

    // Check if firebase_user_id column exists in up_users table
    const columnCheck = await strapi.db.connection.raw(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'up_users'
      AND column_name IN ('firebase_user_id', 'apple_email')
    `);

    const columnsExist = columnCheck.rows && columnCheck.rows.length > 0;

    if (!columnsExist) {
      strapi.log.info("✅ Migration not needed - User table has no Firebase columns (clean database)");
      strapi.log.info(
        "This is expected for fresh installations where Firebase plugin owns all Firebase data."
      );
      strapi.log.info("");
      return result;
    }

    strapi.log.info("Firebase columns found in User table - proceeding with migration...");
    strapi.log.info("");

    // Step 2: Get all users with Firebase data
    strapi.log.info("Step 2: Finding users with Firebase data...");

    // Use raw query - select snake_case columns, then map to camelCase in JavaScript
    // Note: idToken NOT included (tokens expire in 1 hour, not needed for migration)
    const usersWithFirebaseData = (await strapi.db.connection
      .select("id", "document_id", "username", "email", "firebase_user_id", "apple_email")
      .from("up_users")
      .where(function () {
        this.whereNotNull("firebase_user_id").orWhereNotNull("apple_email");
      })) as UserWithFirebaseData[];

    // Fix type issue: Knex count returns array with object containing string | number
    const countResult = await strapi.db.connection("up_users").count("* as count");
    result.totalUsers = Number(countResult[0].count);
    result.usersWithFirebaseData = usersWithFirebaseData.length;

    strapi.log.info(`Total users: ${result.totalUsers}`);
    strapi.log.info(`Users with Firebase data: ${result.usersWithFirebaseData}`);
    strapi.log.info("");

    if (result.usersWithFirebaseData === 0) {
      strapi.log.info("No users with Firebase data found. Migration complete.");
      return result;
    }

    // Step 3: Migrate each user
    strapi.log.info("Step 3: Migrating user data...");
    strapi.log.info("");

    for (const user of usersWithFirebaseData) {
      const userIdentifier = `${user.username} (${user.email})`;

      try {
        // Check if firebase_user_data already exists for this user
        const existing = await strapi.db.query("plugin::firebase-authentication.firebase-user-data").findOne({
          where: { user: { documentId: user.document_id } },
        });

        if (existing) {
          strapi.log.info(`⏭️  SKIP: ${userIdentifier} - Already has firebase_user_data record`);
          result.skipped++;
          continue;
        }

        // Prepare data for migration (only 2 fields)
        const firebaseData: any = {
          user: user.document_id,
        };

        // Map snake_case to camelCase
        if (user.firebase_user_id) {
          firebaseData.firebaseUserID = user.firebase_user_id;
        }

        if (user.apple_email) {
          firebaseData.appleEmail = user.apple_email;
        }

        // Note: idToken is NOT migrated (tokens expire in 1 hour, not needed)

        // Log what will be migrated (only 2 fields)
        strapi.log.info(`🔄 MIGRATE: ${userIdentifier}`);
        strapi.log.info(`   Firebase UID: ${firebaseData.firebaseUserID || "none"}`);
        strapi.log.info(`   Apple Email: ${firebaseData.appleEmail || "none"}`);

        if (!dryRun) {
          // Create firebase_user_data record with unique constraint handling
          try {
            await strapi.db.query("plugin::firebase-authentication.firebase-user-data").create({
              data: firebaseData,
            });

            strapi.log.info(`   ✅ SUCCESS`);
          } catch (createError: any) {
            // Handle unique constraint violations (PostgreSQL error code 23505)
            if (createError.code === "23505") {
              strapi.log.warn(`   ⚠️  SKIP: Unique constraint violation (already exists)`);
              result.skipped++;
              continue;
            }
            // Re-throw other errors to be caught by outer catch
            throw createError;
          }
        } else {
          strapi.log.info(`   🔍 DRY RUN - Would create record`);
        }

        result.migrated++;
        strapi.log.info("");
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        strapi.log.error(`❌ ERROR: ${userIdentifier}`);
        strapi.log.error(`   ${errorMessage}`);
        strapi.log.error("");

        result.errors.push({
          user: userIdentifier,
          error: errorMessage,
        });
      }
    }

    // Step 4: Verify migration
    strapi.log.info("Step 4: Verifying migration...");

    const finalCount = await strapi.db.query("plugin::firebase-authentication.firebase-user-data").count();

    strapi.log.info(`Total firebase_user_data records: ${finalCount}`);
    strapi.log.info("");

    // Step 5: Summary
    strapi.log.info("=== Migration Summary ===");
    strapi.log.info(`Total users: ${result.totalUsers}`);
    strapi.log.info(`Users with Firebase data: ${result.usersWithFirebaseData}`);
    strapi.log.info(`Migrated: ${result.migrated}`);
    strapi.log.info(`Skipped (already migrated): ${result.skipped}`);
    strapi.log.info(`Errors: ${result.errors.length}`);

    if (result.errors.length > 0) {
      strapi.log.error("");
      strapi.log.error("=== Errors ===");
      result.errors.forEach(({ user, error }) => {
        strapi.log.error(`${user}: ${error}`);
      });
    }

    strapi.log.info("");

    if (dryRun) {
      strapi.log.info("🔍 DRY RUN COMPLETE - No changes were made");
      strapi.log.info("Run again with dryRun=false to perform actual migration");
    } else if (result.errors.length === 0) {
      strapi.log.info("✅ MIGRATION COMPLETE - All users migrated successfully!");
    } else {
      strapi.log.warn("⚠️  MIGRATION COMPLETE WITH ERRORS - Review errors above");
    }
  } catch (error) {
    strapi.log.error("Fatal error during migration:");
    strapi.log.error(error);
    throw error;
  }

  return result;
}

export default migrateFirebaseUserData;

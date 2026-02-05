import type { Core } from "@strapi/strapi";

interface DuplicateInfo {
  user_id: number;
  count: string;
}

interface MigrationResult {
  status: "created" | "exists" | "blocked_by_duplicates" | "table_not_found" | "error";
  duplicates?: DuplicateInfo[];
}

/**
 * Ensure unique constraint on firebase_user_data_user_lnk.user_id
 *
 * This migration:
 * 1. Checks if the unique index already exists (idempotent)
 * 2. Checks for existing duplicates BEFORE trying to create index
 * 3. If duplicates exist: logs warning, returns info, skips creation
 * 4. If no duplicates: creates the unique index
 *
 * SAFE: This only prevents future duplicates, does NOT delete existing data.
 */
async function ensureUserLinkUniqueConstraint(strapi: Core.Strapi): Promise<MigrationResult> {
  const indexName = "firebase_user_data_user_lnk_user_id_unique";
  const tableName = "firebase_user_data_user_lnk";

  try {
    // Check if index already exists
    const indexExists = await strapi.db.connection.raw(
      `
      SELECT 1 FROM pg_indexes
      WHERE indexname = ?
    `,
      [indexName]
    );

    if (indexExists.rows && indexExists.rows.length > 0) {
      strapi.log.info(`[Firebase Auth] ✅ Unique constraint ${indexName} already exists`);
      return { status: "exists" };
    }

    // Check if the link table exists (might not exist on fresh installs before first use)
    const tableExists = await strapi.db.connection.raw(
      `
      SELECT 1 FROM information_schema.tables
      WHERE table_name = ?
    `,
      [tableName]
    );

    if (!tableExists.rows || tableExists.rows.length === 0) {
      strapi.log.info(
        `[Firebase Auth] ⏭️ Table ${tableName} doesn't exist yet - skipping constraint creation`
      );
      return { status: "table_not_found" };
    }

    // CHECK FOR EXISTING DUPLICATES BEFORE CREATING INDEX
    const duplicates = await strapi.db.connection.raw(`
      SELECT user_id, COUNT(*) as count
      FROM ${tableName}
      WHERE user_id IS NOT NULL
      GROUP BY user_id
      HAVING COUNT(*) > 1
    `);

    if (duplicates.rows && duplicates.rows.length > 0) {
      strapi.log.warn("");
      strapi.log.warn("╔══════════════════════════════════════════════════════════════════╗");
      strapi.log.warn("║  ⚠️  CANNOT CREATE UNIQUE CONSTRAINT - DUPLICATES EXIST          ║");
      strapi.log.warn("╚══════════════════════════════════════════════════════════════════╝");
      strapi.log.warn("");
      strapi.log.warn(`Found ${duplicates.rows.length} user(s) with multiple firebase_user_data records:`);
      strapi.log.warn("");

      for (const dup of duplicates.rows) {
        strapi.log.warn(`   user_id: ${dup.user_id} → ${dup.count} records`);
      }

      strapi.log.warn("");
      strapi.log.warn("To fix this:");
      strapi.log.warn("   1. Run with FIREBASE_REPORT_ORPHANS=true to see full report");
      strapi.log.warn("   2. Manually delete duplicate records, keeping only one per user");
      strapi.log.warn("   3. Restart Strapi - constraint will be created automatically");
      strapi.log.warn("");
      strapi.log.warn("Quick fix SQL (keeps lowest ID, deletes others):");
      strapi.log.warn("");
      strapi.log.warn("   DELETE FROM firebase_user_data_user_lnk");
      strapi.log.warn("   WHERE id NOT IN (");
      strapi.log.warn("     SELECT MIN(id) FROM firebase_user_data_user_lnk");
      strapi.log.warn("     GROUP BY user_id");
      strapi.log.warn("   );");
      strapi.log.warn("");

      return {
        status: "blocked_by_duplicates",
        duplicates: duplicates.rows as DuplicateInfo[],
      };
    }

    // No duplicates - safe to create the unique index
    strapi.log.info(`[Firebase Auth] Creating unique constraint ${indexName}...`);

    await strapi.db.connection.raw(`
      CREATE UNIQUE INDEX ${indexName}
      ON ${tableName} (user_id)
      WHERE user_id IS NOT NULL
    `);

    strapi.log.info(`[Firebase Auth] ✅ Unique constraint ${indexName} created successfully`);
    return { status: "created" };
  } catch (error) {
    // Handle race condition where another instance created the index
    if (error.code === "42P07" || error.message?.includes("already exists")) {
      strapi.log.info(`[Firebase Auth] ✅ Unique constraint ${indexName} was created by another process`);
      return { status: "exists" };
    }

    strapi.log.error(`[Firebase Auth] Failed to create unique constraint: ${error.message}`);
    return { status: "error" };
  }
}

export default ensureUserLinkUniqueConstraint;

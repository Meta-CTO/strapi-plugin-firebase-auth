import type { Core } from "@strapi/strapi";

interface OrphanReport {
  duplicateEmailGroups: number;
  orphanUsers: Array<{
    id: number;
    email: string;
    username: string;
    created_at: string;
    has_firebase_link: boolean;
  }>;
  usersToKeep: Array<{
    id: number;
    email: string;
    firebase_user_id: string;
  }>;
  emailsNeedingNormalization: number;
}

/**
 * Report potential orphan users created by the email whitespace bug
 *
 * This migration:
 * 1. Finds duplicate emails (with/without whitespace)
 * 2. Identifies which users have Firebase links (KEEP) vs orphans (potential DELETE)
 * 3. ONLY REPORTS - does NOT delete anything
 *
 * Run with: FIREBASE_REPORT_ORPHANS=true yarn develop
 *
 * After reviewing the report, admins can run the cleanup SQL manually.
 */
async function reportOrphanUsers(strapi: Core.Strapi): Promise<OrphanReport | null> {
  strapi.log.info("");
  strapi.log.info("╔══════════════════════════════════════════════════════════════════╗");
  strapi.log.info("║       FIREBASE AUTH - ORPHAN USER REPORT (READ-ONLY)            ║");
  strapi.log.info("╚══════════════════════════════════════════════════════════════════╝");
  strapi.log.info("");

  const report: OrphanReport = {
    duplicateEmailGroups: 0,
    orphanUsers: [],
    usersToKeep: [],
    emailsNeedingNormalization: 0,
  };

  try {
    // Step 1: Find duplicate emails (whitespace variations)
    // Uses nested REGEXP_REPLACE to handle ALL \s whitespace (spaces, tabs, newlines, etc.)
    // This matches JavaScript's .trim() behavior for consistency
    const duplicates = await strapi.db.connection.raw(`
      SELECT
        LOWER(REGEXP_REPLACE(REGEXP_REPLACE(email, E'^\\\\s+', ''), E'\\\\s+$', '')) as normalized_email,
        COUNT(*) as duplicate_count,
        array_agg(id ORDER BY created_at) as user_ids
      FROM up_users
      WHERE email IS NOT NULL AND email LIKE '%@%'
      GROUP BY LOWER(REGEXP_REPLACE(REGEXP_REPLACE(email, E'^\\\\s+', ''), E'\\\\s+$', ''))
      HAVING COUNT(*) > 1
      ORDER BY duplicate_count DESC
    `);

    report.duplicateEmailGroups = duplicates.rows?.length || 0;

    if (report.duplicateEmailGroups === 0) {
      strapi.log.info("✅ No duplicate emails found - database is clean!");
      strapi.log.info("");
      return report;
    }

    strapi.log.warn(`⚠️  Found ${report.duplicateEmailGroups} email(s) with duplicate users`);
    strapi.log.info("");

    // Step 2: For each duplicate group, identify orphans vs keepers
    for (const row of duplicates.rows) {
      strapi.log.info(`📧 ${row.normalized_email} (${row.duplicate_count} users):`);

      // Get details for each user in this duplicate group
      const users = await strapi.db.connection.raw(
        `
        SELECT
          u.id,
          u.email,
          u.username,
          u.created_at,
          CASE WHEN lnk.id IS NOT NULL THEN true ELSE false END as has_firebase_link,
          fud.firebase_user_id
        FROM up_users u
        LEFT JOIN firebase_user_data_user_lnk lnk ON u.id = lnk.user_id
        LEFT JOIN firebase_user_data fud ON lnk.firebase_user_data_id = fud.id
        WHERE u.id = ANY(?)
        ORDER BY u.created_at
      `,
        [row.user_ids]
      );

      for (const user of users.rows) {
        const action = user.has_firebase_link ? "KEEP ✓" : "ORPHAN ✗";
        const linkInfo = user.firebase_user_id ? `UID: ${user.firebase_user_id}` : "No Firebase link";

        strapi.log.info(`   ${action} | ID ${user.id} | "${user.email}" | ${linkInfo}`);

        if (user.has_firebase_link) {
          report.usersToKeep.push({
            id: user.id,
            email: user.email,
            firebase_user_id: user.firebase_user_id,
          });
        } else {
          report.orphanUsers.push({
            id: user.id,
            email: user.email,
            username: user.username,
            created_at: user.created_at,
            has_firebase_link: false,
          });
        }
      }
      strapi.log.info("");
    }

    // Step 3: Check for emails needing normalization (includes tabs and other whitespace)
    const unnormalized = await strapi.db.connection.raw(`
      SELECT COUNT(*) as count
      FROM up_users
      WHERE email IS NOT NULL
      AND email ~ E'^\\\\s|\\\\s$'
    `);

    report.emailsNeedingNormalization = parseInt(unnormalized.rows[0]?.count || "0");

    // Summary
    strapi.log.info("╔══════════════════════════════════════════════════════════════════╗");
    strapi.log.info("║                           SUMMARY                                ║");
    strapi.log.info("╚══════════════════════════════════════════════════════════════════╝");
    strapi.log.info(`   Duplicate email groups: ${report.duplicateEmailGroups}`);
    strapi.log.info(`   Users to KEEP (have Firebase link): ${report.usersToKeep.length}`);
    strapi.log.info(`   ORPHAN users (no Firebase link): ${report.orphanUsers.length}`);
    strapi.log.info(`   Emails needing normalization: ${report.emailsNeedingNormalization}`);
    strapi.log.info("");

    if (report.orphanUsers.length > 0) {
      strapi.log.warn("⚠️  To clean up orphan users, run this SQL AFTER REVIEWING THE REPORT:");
      strapi.log.info("");
      strapi.log.info("   -- Delete orphan users (IDs from this report)");
      strapi.log.info(
        `   DELETE FROM up_users WHERE id IN (${report.orphanUsers.map((u) => u.id).join(", ")});`
      );
      strapi.log.info("");
    }

    if (report.emailsNeedingNormalization > 0) {
      strapi.log.warn("⚠️  To normalize existing emails (removes all whitespace), run this SQL:");
      strapi.log.info("");
      strapi.log.info("   UPDATE up_users");
      strapi.log.info(
        "   SET email = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(email, E'^\\\\s+', ''), E'\\\\s+$', ''))"
      );
      strapi.log.info("   WHERE email IS NOT NULL AND email ~ E'^\\\\s|\\\\s$';");
      strapi.log.info("");
    }

    strapi.log.info("╔══════════════════════════════════════════════════════════════════╗");
    strapi.log.info("║  THIS WAS A READ-ONLY REPORT - NO DATA WAS MODIFIED             ║");
    strapi.log.info("╚══════════════════════════════════════════════════════════════════╝");
    strapi.log.info("");

    return report;
  } catch (error) {
    strapi.log.error(`[Firebase Auth] Orphan report failed: ${error.message}`);
    return null;
  }
}

export default reportOrphanUsers;

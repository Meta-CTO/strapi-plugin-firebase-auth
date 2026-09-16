import { ADMIN_CLAIM, type AdminLoginConfig } from "./admin-login-authorize";

type StartupEnv = {
  hasSessionManager: boolean;
  log: { warn: (message: string) => void; error: (message: string) => void; info: (message: string) => void };
};

/**
 * One-time boot report for the admin-login feature. Pure: takes the normalized config and the facts it needs.
 */
export function reportAdminLoginStartup(config: AdminLoginConfig, env: StartupEnv): void {
  if (!config.enabled) return;

  if (!env.hasSessionManager) {
    env.log.error(
      "[Firebase Auth Plugin] adminLogin.enabled is true but this Strapi version has no session manager. Admin login requires Strapi 5.24.0 or newer; the endpoint will answer 503 until you upgrade."
    );
    return;
  }

  if (config.allowedEmails.length === 0 && config.allowedDomains.length === 0) {
    env.log.warn(
      `[Firebase Auth Plugin] adminLogin is enabled with no allowedEmails or allowedDomains. Only Firebase users carrying a truthy "${ADMIN_CLAIM}" custom claim can log in.`
    );
  }

  env.log.info(
    `[Firebase Auth Plugin] Admin login enabled: ${config.allowedEmails.length} email(s), ${config.allowedDomains.length} domain(s), auto-create role: ${config.autoCreateRole ?? "off"}`
  );
}

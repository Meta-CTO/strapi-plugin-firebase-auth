export type AdminLoginConfig = {
  enabled: boolean;
  allowedEmails: string[];
  allowedDomains: string[];
  autoCreateRole: string | null;
};

export const DEFAULT_ADMIN_LOGIN_CONFIG: AdminLoginConfig = {
  enabled: false,
  allowedEmails: [],
  allowedDomains: [],
  autoCreateRole: null,
};

const cleanList = (value: unknown, stripAt: boolean): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().toLowerCase())
    .map((item) => (stripAt && item.startsWith("@") ? item.slice(1) : item))
    .filter((item) => item.length > 0);
};

/**
 * Normalize the raw adminLogin config block from config/plugins.ts.
 * Missing or malformed values fall back to the safe defaults (feature off, nobody allowed).
 */
export function normalizeAdminLoginConfig(raw: unknown): AdminLoginConfig {
  const block = (raw ?? {}) as Partial<Record<keyof AdminLoginConfig, unknown>>;
  const role = typeof block.autoCreateRole === "string" ? block.autoCreateRole.trim() : "";
  return {
    enabled: block.enabled === true,
    allowedEmails: cleanList(block.allowedEmails, false),
    allowedDomains: cleanList(block.allowedDomains, true),
    autoCreateRole: role.length > 0 ? role : null,
  };
}

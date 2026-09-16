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

export const ADMIN_CLAIM = "strapiAdmin";

export type AdminLoginToken = {
  uid: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
} & Record<string, unknown>;

export type AuthorizeResult =
  | { allowed: true; via: "email" | "domain" | "claim"; email: string }
  | { allowed: false; reason: "email_missing" | "email_unverified" | "not_allowlisted" };

/**
 * Decide whether a verified Firebase user may log into the Strapi admin panel.
 * Pure function: no I/O, no strapi access. Order of checks:
 *   1. email present            -> else email_missing
 *   2. email verified           -> else email_unverified
 *   3. exact email allowlisted  -> via "email"
 *   4. email domain allowlisted -> via "domain"
 *   5. custom claim truthy      -> via "claim"
 *   6. otherwise                -> not_allowlisted
 */
export function authorizeAdminLogin(token: AdminLoginToken, config: AdminLoginConfig): AuthorizeResult {
  const rawEmail = typeof token.email === "string" ? token.email.trim().toLowerCase() : "";
  if (!rawEmail) {
    return { allowed: false, reason: "email_missing" };
  }
  if (token.email_verified !== true) {
    return { allowed: false, reason: "email_unverified" };
  }

  if (config.allowedEmails.includes(rawEmail)) {
    return { allowed: true, via: "email", email: rawEmail };
  }

  const at = rawEmail.lastIndexOf("@");
  const domain = at >= 0 ? rawEmail.slice(at + 1) : "";
  if (domain && config.allowedDomains.includes(domain)) {
    return { allowed: true, via: "domain", email: rawEmail };
  }

  if (token[ADMIN_CLAIM]) {
    return { allowed: true, via: "claim", email: rawEmail };
  }

  return { allowed: false, reason: "not_allowlisted" };
}

/**
 * Strapi admin users require both firstname and lastname.
 * Derive them from the Firebase display name, falling back to the email local part.
 */
export function splitDisplayName(
  name: string | undefined,
  email: string
): { firstname: string; lastname: string } {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    const local = email.split("@")[0] || email;
    return { firstname: local, lastname: "-" };
  }
  const [firstname, ...rest] = words;
  return { firstname, lastname: rest.length > 0 ? rest.join(" ") : "-" };
}

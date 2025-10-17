import { User } from "../../../model/User";

/**
 * Checks if a Firebase user has password authentication enabled
 *
 * @param user - Firebase user object or null
 * @returns true if user has password provider, false otherwise
 */
export const hasPasswordProvider = (user: User | null): boolean => {
  if (!user) return false;

  // Check if user has providerData array
  if (!user.providerData || !Array.isArray(user.providerData)) {
    return false;
  }

  // Check if any provider is "password"
  return user.providerData.some((provider) => provider.providerId === "password");
};

/**
 * Gets tooltip text explaining why password reset is disabled
 *
 * @param user - Firebase user object or null
 * @returns Tooltip text explaining the disabled state
 */
export const getPasswordResetTooltip = (user: User | null): string => {
  if (!user) {
    return "No user selected";
  }

  if (!user.providerData || user.providerData.length === 0) {
    return "User has no authentication providers";
  }

  const providers = user.providerData.map((p) => p.providerId).join(", ");

  if (user.providerData.some((p) => p.providerId === "phone")) {
    return `This user authenticates with phone number only. Password reset is not available.`;
  }

  if (user.providerData.some((p) => p.providerId === "google.com")) {
    return `This user authenticates with Google. Please use Google's account recovery.`;
  }

  if (user.providerData.some((p) => p.providerId === "apple.com")) {
    return `This user authenticates with Apple. Please use Apple's account recovery.`;
  }

  return `Password reset is only available for users with email/password authentication. Current provider(s): ${providers}`;
};

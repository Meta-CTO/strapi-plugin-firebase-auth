import { errors } from "@strapi/utils";

/**
 * is-authenticated policy
 * Requires a valid JWT token - returns 401 Unauthorized if not authenticated
 */
export default async (policyContext) => {
  const user = policyContext.state.user;
  if (!user) {
    throw new errors.UnauthorizedError("Authentication required");
  }
  return true;
};

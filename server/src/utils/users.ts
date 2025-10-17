import { StrapiUser } from "../../../model/User";

export const formatUserData = (result: any, strapiUsersData: StrapiUser[]) => ({
  ...result,
  users: result?.users?.map((user: any) => {
    // Match by primary key first, then fall back to email/phone
    const matchedStrapiUser = strapiUsersData.find(
      (strapiUser: StrapiUser) =>
        // Primary key matching (most reliable)
        (strapiUser.firebaseUserID && strapiUser.firebaseUserID === user.uid) ||
        // Email matching (including Apple relay emails)
        (user.email && (strapiUser.email === user.email || strapiUser.appleEmail === user.email)) ||
        // Phone number matching
        (user.phoneNumber && strapiUser.phoneNumber === user.phoneNumber)
    );

    if (!matchedStrapiUser) return user;

    // CRITICAL FIX: Reverse spread order - Strapi first, Firebase second
    // This ensures Firebase's displayName and phoneNumber are preserved
    return {
      ...matchedStrapiUser, // Strapi data first (base data)
      ...user, // Firebase data second (authoritative for auth fields)
      // Preserve specific IDs
      strapiId: matchedStrapiUser.id,
      strapiDocumentId: matchedStrapiUser.documentId,
      firebaseUserID: user.uid,
      id: user.uid,
      // Explicitly preserve critical Firebase fields
      displayName:
        user.displayName ||
        matchedStrapiUser.displayName ||
        (matchedStrapiUser.firstName && matchedStrapiUser.lastName
          ? `${matchedStrapiUser.firstName} ${matchedStrapiUser.lastName}`.trim()
          : null),
      phoneNumber: user.phoneNumber || matchedStrapiUser.phoneNumber,
      email: user.email || matchedStrapiUser.email,
      // Preserve Firebase metadata
      metadata: user.metadata,
      emailVerified: user.emailVerified,
      disabled: user.disabled,
      providerData: user.providerData,
      tokensValidAfterTime: user.tokensValidAfterTime,
      photoURL: user.photoURL,
    };
  }),
});

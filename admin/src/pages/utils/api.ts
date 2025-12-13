import { User } from "../../../../model/User";
import { Query } from "../../../../model/Request";
import { getFetchClient } from "@strapi/strapi/admin";
import { PLUGIN_ID } from "../../pluginId";

const fetchStrapiUserById = async (userId: string) => {
  const url = `/${PLUGIN_ID}/users/${userId}`;

  try {
    const { get } = getFetchClient();
    const { data: user } = await get(url);
    return user;
  } catch (e) {
    return [];
  }
};

const fetchStrapiUsers = async (query: Query = {}) => {
  if (!query.page) {
    query.page = 1;
  }

  if (!query.pageSize) {
    query.pageSize = 10;
  }

  let url = `/${PLUGIN_ID}/users?pagination[page]=${query.page}&pagination[pageSize]=${query.pageSize}`;

  if (query.nextPageToken) {
    url += `&nextPageToken=${query.nextPageToken}`;
  }

  try {
    const { get } = getFetchClient();
    const { data: users } = await get(url);

    return users;
  } catch (e) {
    return [];
  }
};

const fetchUsers = async (query: Query = {}) => {
  if (!query.page) {
    query.page = 1;
  }

  if (!query.pageSize) {
    query.pageSize = 10;
  }

  let url = `/${PLUGIN_ID}/users?pagination[page]=${query.page}&pagination[pageSize]=${query.pageSize}`;

  if (query.nextPageToken) {
    url += `&nextPageToken=${query.nextPageToken}`;
  }

  if (query.sort) {
    url += `&sort=${query.sort}`;
  }

  if (query.search) {
    url += `&search=${encodeURIComponent(query.search)}`;
  }

  const { get } = getFetchClient();
  const { data: users } = await get(url);
  return users;
};

/**
 * @description Create firebase user
 * @param {Object} userPayload
 * @returns {Object} user
 */

const createUser = async (userPayload: User) => {
  const url = `/${PLUGIN_ID}/users`;
  try {
    const { post } = getFetchClient();
    const { data: user } = await post(url, userPayload);
    return user;
  } catch (e) {
    return null;
  }
};

/**
 * @description Fetch single user
 * @param {String} userID
 * @returns {Object} user
 */

const fetchUserByID = async (userID: string) => {
  const url = `/${PLUGIN_ID}/users/${userID}`;
  try {
    const { get } = getFetchClient();
    const { data: user } = await get(url);
    return user;
  } catch (e) {
    return [];
  }
};

/**
 * @description Delete user by id
 * @param {String} idToDelete
 * @returns {Object} user
 */

const deleteUser = async (idToDelete: string, destination: string | null) => {
  const url = `/${PLUGIN_ID}/users/${idToDelete}${destination ? `?destination=${destination}` : ""}`;
  try {
    const { del } = getFetchClient();
    const { data: users } = await del(url);

    return users.data;
  } catch (e) {
    return {};
  }
};

/**
 * @description Update user by id
 * @param {String} idToUpdate
 * @param {Object} payload
 * @returns {Object} user
 */

const updateUser = async (idToUpdate: string, payload: User) => {
  const url = `/${PLUGIN_ID}/users/${idToUpdate}`;
  const { put } = getFetchClient();
  const { data: user } = await put(url, payload);

  return user;
};

const resetUserPassword = async (idToUpdate: string, payload: { password: string }) => {
  const url = `/${PLUGIN_ID}/users/resetPassword/${idToUpdate}`;
  const { put } = getFetchClient();
  const { data: user } = await put(url, payload);

  return user;
};

const sendResetEmail = async (userId: string) => {
  const url = `/${PLUGIN_ID}/users/sendResetEmail/${userId}`;
  const { put } = getFetchClient();
  const { data: result } = await put(url, {});

  return result;
};

const getFirebaseConfig = async () => {
  const url = `/api/${PLUGIN_ID}/config`;
  try {
    const { get } = getFetchClient();
    const { data: config } = await get(url, {
      headers: {
        "Strapi-Response-Format": "v5", // Ensure Strapi v5 response format
      },
    });
    return config;
  } catch (e) {
    // Return default config if endpoint fails
    return {
      passwordRequirementsRegex: "^.{6,}$",
      passwordRequirementsMessage: "Password must be at least 6 characters long",
      passwordResetUrl: "http://localhost:3000/reset-password",
      passwordResetEmailSubject: "Reset Your Password",
    };
  }
};

const sendPasswordResetEmail = async (userId: string) => {
  // This is an alias for sendResetEmail for consistency
  return sendResetEmail(userId);
};

const sendVerificationEmail = async (userId: string) => {
  const url = `/${PLUGIN_ID}/users/sendVerificationEmail/${userId}`;
  const { put } = getFetchClient();
  const { data: result } = await put(url, {});

  return result;
};

export {
  fetchUsers,
  fetchUserByID,
  deleteUser,
  updateUser,
  createUser,
  fetchStrapiUsers,
  fetchStrapiUserById,
  resetUserPassword,
  sendResetEmail,
  getFirebaseConfig,
  sendPasswordResetEmail,
  sendVerificationEmail,
};

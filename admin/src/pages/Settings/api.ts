import { getFetchClient } from "@strapi/strapi/admin";
import { PLUGIN_ID } from "../../pluginId";

export const restartServer = async () => {
  const url = `/${PLUGIN_ID}/settings/restart`;
  const { post } = getFetchClient();
  await post(url);
};

export const saveFirebaseConfig = async (
  json: string,
  firebaseWebApiKey?: string,
  passwordConfig?: {
    passwordRequirementsRegex?: string;
    passwordRequirementsMessage?: string;
    passwordResetUrl?: string;
    passwordResetEmailSubject?: string;
  }
) => {
  const url = `/${PLUGIN_ID}/settings/firebase-config`;
  const { post } = getFetchClient();
  const { data } = await post(url, {
    firebaseConfigJson: json,
    firebaseWebApiKey,
    ...passwordConfig,
  });
  return data;
};

export const getFirebaseConfig = async () => {
  const url = `/${PLUGIN_ID}/settings/firebase-config`;
  const { get } = getFetchClient();
  const { data } = await get(url);
  return data;
};

export const delFirebaseConfig = async () => {
  const url = `/${PLUGIN_ID}/settings/firebase-config`;
  const { del } = getFetchClient();
  const { data } = await del(url);
  return data;
};

export const savePasswordSettings = async (passwordConfig: {
  passwordRequirementsRegex?: string;
  passwordRequirementsMessage?: string;
  passwordResetUrl?: string;
  passwordResetEmailSubject?: string;
}) => {
  const url = `/${PLUGIN_ID}/settings/password-config`;
  const { post } = getFetchClient();
  const { data } = await post(url, passwordConfig);
  return data;
};

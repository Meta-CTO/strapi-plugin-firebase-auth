import { errors } from "@strapi/utils";
import admin, { ServiceAccount } from "firebase-admin";
import checkValidJson from "../utils/check-valid-json";
import CryptoJS from "crypto-js";
import {
  CONFIG_CONTENT_TYPE,
  CONFIG_KEYS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  VALIDATION_MESSAGES,
  REQUIRED_FIELDS,
  DEFAULT_PASSWORD_RESET_URL,
  DEFAULT_PASSWORD_MESSAGE,
  DEFAULT_PASSWORD_REGEX,
  DEFAULT_RESET_EMAIL_SUBJECT,
} from "../constants";

const { ValidationError, ApplicationError } = errors;
export default ({ strapi }) => {
  const encryptionKey = strapi.config.get(CONFIG_KEYS.ENCRYPTION_KEY);

  return {
    async init() {
      try {
        strapi.log.info("Starting Firebase initialization...");
        const res = await strapi.db.query(CONFIG_CONTENT_TYPE).findOne({ where: {} });
        strapi.log.debug(`Found config: ${!!res}`);

        if (!res) {
          strapi.log.debug("No config found, checking for existing Firebase app...");
          if (strapi.firebase) {
            strapi.log.debug("Deleting existing Firebase app...");
            await strapi.firebase.app().delete();
          }
          return;
        }

        const jsonObject = res["firebase_config_json"];
        strapi.log.debug(`Config JSON present: ${!!jsonObject?.firebaseConfigJson}`);

        if (!jsonObject || !jsonObject.firebaseConfigJson) {
          strapi.log.debug("No valid JSON config, checking for existing Firebase app...");
          if (strapi.firebase) {
            strapi.log.debug("Deleting existing Firebase app...");
            await strapi.firebase.app().delete();
          }
          return;
        }

        strapi.log.debug("Decrypting JSON config...");
        const firebaseConfigJson = await this.decryptJson(encryptionKey, jsonObject.firebaseConfigJson);

        strapi.log.debug("Validating service account...");
        const serviceAccount = checkValidJson(firebaseConfigJson);
        if (!serviceAccount) {
          strapi.log.warn("Invalid service account JSON");
          return;
        }

        strapi.log.info("Initializing Firebase app...");

        // Check if Firebase app already exists and delete it
        try {
          const existingApp = admin.app();
          if (existingApp) {
            strapi.log.debug("Deleting existing Firebase app before re-initialization...");
            await existingApp.delete();
            strapi.log.debug("Existing app deleted");
          }
        } catch (error) {
          // App doesn't exist, which is fine - continue with initialization
          strapi.log.debug("No existing Firebase app found, proceeding with initialization");
        }

        // Initialize Firebase
        try {
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount as ServiceAccount),
          });
          strapi.firebase = admin;
          strapi.log.info("Firebase initialization complete - admin instance attached to strapi.firebase");
        } catch (initError) {
          strapi.log.error(`Failed to initialize Firebase: ${initError.message}`);
          throw initError;
        }
      } catch (error) {
        strapi.log.error(`Firebase bootstrap error: ${error.message}`);
      }
    },
    /**
     * Retrieves and decrypts the Firebase configuration including Web API key and password reset settings
     *
     * @returns Firebase configuration object or null if not configured
     *
     * @throws ApplicationError - When there's an error retrieving or decrypting the configuration
     *
     * @remarks
     * Returns an object containing:
     * - `firebaseConfigJson`: Decrypted Firebase service account JSON string
     * - `firebaseWebApiKey`: Firebase Web API key for Identity Toolkit API calls
     * - `passwordRequirementsRegex`: Regex pattern for password validation
     * - `passwordRequirementsMessage`: Error message for invalid passwords
     * - `passwordResetUrl`: URL for password reset page
     * - `passwordResetEmailSubject`: Subject line for reset emails
     */
    async getFirebaseConfigJson() {
      const key = encryptionKey;
      try {
        const configObject = await strapi.db.query(CONFIG_CONTENT_TYPE).findOne({ where: {} });

        if (!configObject || !configObject["firebase_config_json"]) {
          return null;
        }

        const firebaseConfigJsonObj = configObject["firebase_config_json"];
        const hashedJson = firebaseConfigJsonObj["firebaseConfigJson"];

        if (!hashedJson) {
          return null;
        }

        const firebaseConfigJson = await this.decryptJson(key, hashedJson);
        return {
          firebaseConfigJson,
          firebaseWebApiKey: configObject.firebase_web_api_key || null, // May be null if not configured
          // Include password reset configuration fields
          passwordRequirementsRegex: configObject.passwordRequirementsRegex || DEFAULT_PASSWORD_REGEX,
          passwordRequirementsMessage: configObject.passwordRequirementsMessage || DEFAULT_PASSWORD_MESSAGE,
          passwordResetUrl: configObject.passwordResetUrl || DEFAULT_PASSWORD_RESET_URL,
          passwordResetEmailSubject: configObject.passwordResetEmailSubject || DEFAULT_RESET_EMAIL_SUBJECT,
          // Include magic link configuration fields
          enableMagicLink: configObject.enableMagicLink || false,
          magicLinkUrl: configObject.magicLinkUrl || "http://localhost:1338/verify-magic-link.html",
          magicLinkEmailSubject: configObject.magicLinkEmailSubject || "Sign in to Your Application",
          magicLinkExpiryHours: configObject.magicLinkExpiryHours || 1,
          // Include email verification configuration fields
          emailVerificationUrl: configObject.emailVerificationUrl || "http://localhost:3000/verify-email",
          emailVerificationEmailSubject: configObject.emailVerificationEmailSubject || "Verify Your Email",
          // Include credentials in link settings
          includeCredentialsInPasswordResetLink: configObject.includeCredentialsInPasswordResetLink || false,
          includeCredentialsInVerificationLink: configObject.includeCredentialsInVerificationLink || false,
        };
      } catch (error) {
        strapi.log.error(`Firebase config error: ${error.message}`);
        throw new errors.ApplicationError("Error retrieving Firebase config", {
          error: error.message,
        });
      }
    },

    /**
     * Stores and encrypts Firebase configuration including Web API key and password reset settings
     *
     * @param ctx - Koa context object containing the configuration in request body
     * @returns The saved configuration object with decrypted values
     *
     * @throws ValidationError - When required data is missing
     * @throws ApplicationError - When there's an error saving the configuration
     *
     * @remarks
     * Expects request body to contain:
     * - `firebaseConfigJson`: Firebase service account JSON as string
     * - `firebaseWebApiKey`: Firebase Web API key for REST API calls
     * - `passwordRequirementsRegex`: Regex pattern for password validation
     * - `passwordRequirementsMessage`: Error message for invalid passwords
     * - `passwordResetUrl`: URL for password reset page
     * - `passwordResetEmailSubject`: Subject line for reset emails
     *
     * The service account JSON is encrypted using AES before storage,
     * while the Web API key and password settings are stored in plain text.
     */
    async setFirebaseConfigJson(requestBody: any) {
      try {
        strapi.log.debug("setFirebaseConfigJson called");
        const firebaseConfigJsonString = requestBody.firebaseConfigJson;
        const firebaseWebApiKey = requestBody.firebaseWebApiKey || null; // Make Web API Key optional
        // Extract password reset configuration fields
        const {
          passwordRequirementsRegex = DEFAULT_PASSWORD_REGEX,
          passwordRequirementsMessage = DEFAULT_PASSWORD_MESSAGE,
          passwordResetUrl = DEFAULT_PASSWORD_RESET_URL,
          passwordResetEmailSubject = DEFAULT_RESET_EMAIL_SUBJECT,
          enableMagicLink = false,
          magicLinkUrl = "http://localhost:1338/verify-magic-link.html",
          magicLinkEmailSubject = "Sign in to Your Application",
          magicLinkExpiryHours = 1,
          emailVerificationUrl = "http://localhost:3000/verify-email",
          emailVerificationEmailSubject = "Verify Your Email",
          includeCredentialsInPasswordResetLink = false,
          includeCredentialsInVerificationLink = false,
        } = requestBody;

        if (!requestBody) throw new ValidationError(ERROR_MESSAGES.MISSING_DATA);

        // Validate Service Account JSON structure
        try {
          const parsedConfig = JSON.parse(firebaseConfigJsonString);
          const requiredFields = REQUIRED_FIELDS.SERVICE_ACCOUNT;
          const missingFields = requiredFields.filter((field) => !parsedConfig[field]);

          if (missingFields.length > 0) {
            throw new ValidationError(
              `${VALIDATION_MESSAGES.INVALID_SERVICE_ACCOUNT} ${missingFields.join(", ")}. ` +
                VALIDATION_MESSAGES.SERVICE_ACCOUNT_HELP
            );
          }

          // Additional check: if it has apiKey or authDomain, it's the wrong JSON
          if (parsedConfig.apiKey || parsedConfig.authDomain) {
            throw new ValidationError(VALIDATION_MESSAGES.WRONG_JSON_TYPE);
          }
        } catch (parseError) {
          if (parseError instanceof ValidationError) {
            throw parseError;
          }
          throw new ValidationError(ERROR_MESSAGES.INVALID_JSON);
        }

        const hash = await this.encryptJson(encryptionKey, firebaseConfigJsonString);
        const isExist = await strapi.db.query(CONFIG_CONTENT_TYPE).findOne({ where: {} });
        let res: any;
        if (!isExist) {
          res = await strapi.db.query(CONFIG_CONTENT_TYPE).create({
            data: {
              firebase_config_json: { firebaseConfigJson: hash },
              firebase_web_api_key: firebaseWebApiKey,
              passwordRequirementsRegex,
              passwordRequirementsMessage,
              passwordResetUrl,
              passwordResetEmailSubject,
              enableMagicLink,
              magicLinkUrl,
              magicLinkEmailSubject,
              magicLinkExpiryHours,
              emailVerificationUrl,
              emailVerificationEmailSubject,
              includeCredentialsInPasswordResetLink,
              includeCredentialsInVerificationLink,
            },
          });
        } else {
          res = await strapi.db.query(CONFIG_CONTENT_TYPE).update({
            where: { id: isExist.id },
            data: {
              firebase_config_json: { firebaseConfigJson: hash },
              firebase_web_api_key: firebaseWebApiKey,
              passwordRequirementsRegex,
              passwordRequirementsMessage,
              passwordResetUrl,
              passwordResetEmailSubject,
              enableMagicLink,
              magicLinkUrl,
              magicLinkEmailSubject,
              magicLinkExpiryHours,
              emailVerificationUrl,
              emailVerificationEmailSubject,
              includeCredentialsInPasswordResetLink,
              includeCredentialsInVerificationLink,
            },
          });
        }
        await strapi.plugin("firebase-authentication").service("settingsService").init();

        // Auto-link users after Firebase is initialized (non-blocking)
        setImmediate(async () => {
          try {
            await strapi.plugin("firebase-authentication").service("autoLinkService").linkAllUsers(strapi);
          } catch (error) {
            strapi.log.error(`Auto-linking after config save failed: ${error.message}`);
          }
        });

        // Handle both possible field names (camelCase and snake_case)
        // Strapi may or may not convert field names depending on the API used
        const configData = res.firebaseConfigJson || res.firebase_config_json;

        if (!configData) {
          strapi.log.error("Firebase config data missing from database response");
          strapi.log.error(`Available keys in response: ${JSON.stringify(Object.keys(res))}`);
          throw new ApplicationError("Failed to retrieve Firebase configuration from database");
        }

        const firebaseConfigHash = configData.firebaseConfigJson;

        if (!firebaseConfigHash) {
          strapi.log.error(`Firebase config hash missing from config data: ${JSON.stringify(configData)}`);
          throw new ApplicationError("Firebase configuration hash is missing");
        }

        const firebaseConfigJsonValue = await this.decryptJson(encryptionKey, firebaseConfigHash);

        // Ensure the response has the config in the expected format for the admin panel (flat structure)
        res.firebaseConfigJson = firebaseConfigJsonValue;
        res.firebase_config_json = firebaseConfigJsonValue;
        res.firebaseWebApiKey = res.firebase_web_api_key || null;

        // Include password reset fields in the response
        res.passwordRequirementsRegex = res.passwordRequirementsRegex || passwordRequirementsRegex;
        res.passwordRequirementsMessage = res.passwordRequirementsMessage || passwordRequirementsMessage;
        res.passwordResetUrl = res.passwordResetUrl || passwordResetUrl;
        res.passwordResetEmailSubject = res.passwordResetEmailSubject || passwordResetEmailSubject;
        // Include magic link fields in the response - use ?? for boolean
        res.enableMagicLink = res.enableMagicLink ?? enableMagicLink;
        res.magicLinkUrl = res.magicLinkUrl || magicLinkUrl;
        res.magicLinkEmailSubject = res.magicLinkEmailSubject || magicLinkEmailSubject;
        res.magicLinkExpiryHours = res.magicLinkExpiryHours || magicLinkExpiryHours;
        // Include email verification fields in the response
        res.emailVerificationUrl = res.emailVerificationUrl || emailVerificationUrl;
        res.emailVerificationEmailSubject =
          res.emailVerificationEmailSubject || emailVerificationEmailSubject;
        // Include credentials in link settings - use ?? for boolean
        res.includeCredentialsInPasswordResetLink =
          res.includeCredentialsInPasswordResetLink ?? includeCredentialsInPasswordResetLink;
        res.includeCredentialsInVerificationLink =
          res.includeCredentialsInVerificationLink ?? includeCredentialsInVerificationLink;
        return res;
      } catch (error: any) {
        // Detailed error logging for diagnostics
        strapi.log.error("=== FIREBASE CONFIG SAVE ERROR ===");
        strapi.log.error(`Error name: ${error.name}`);
        strapi.log.error(`Error message: ${error.message}`);
        strapi.log.error(`Error stack: ${error.stack}`);

        // Log request body if available
        try {
          if (requestBody) {
            strapi.log.error(`Request body keys: ${JSON.stringify(Object.keys(requestBody))}`);
          }
        } catch (e) {
          strapi.log.error("Could not access request body");
        }

        strapi.log.error("===================================");

        throw new ApplicationError(ERROR_MESSAGES.SOMETHING_WENT_WRONG, {
          error: error.message,
          name: error.name,
          // In development, include more details
          ...(strapi.config.environment === "development" && {
            stack: error.stack?.split("\n").slice(0, 3).join("\n"), // First 3 lines of stack
          }),
        });
      }
    },
    delFirebaseConfigJson: async () => {
      try {
        strapi.log.debug("delFirebaseConfigJson called");
        const isExist = await strapi.db.query(CONFIG_CONTENT_TYPE).findOne({ where: {} });
        strapi.log.debug(`Config exists: ${!!isExist}`);
        if (!isExist) {
          strapi.log.info(ERROR_MESSAGES.DELETION_NO_CONFIG);
          return null;
        }
        const res = await strapi.db.query(CONFIG_CONTENT_TYPE).delete({
          where: { id: isExist.id },
        });
        strapi.log.debug(`Delete result: ${JSON.stringify(res)}`);
        await strapi.plugin("firebase-authentication").service("settingsService").init();
        strapi.log.info(SUCCESS_MESSAGES.FIREBASE_CONFIG_DELETED);
        return res;
      } catch (error) {
        strapi.log.error(`delFirebaseConfigJson error: ${error.message}`);
        throw new ApplicationError(ERROR_MESSAGES.SOMETHING_WENT_WRONG, {
          error: error,
        });
      }
    },

    /**
     * Updates only the magic link settings without affecting other configuration
     */
    async updateMagicLinkSettings(settings: any) {
      try {
        const foundConfig = await strapi.db.query(CONFIG_CONTENT_TYPE).findOne({ where: {} });

        if (!foundConfig) {
          throw new errors.NotFoundError("Configuration not found");
        }

        const result = await strapi.db.query(CONFIG_CONTENT_TYPE).update({
          where: { id: foundConfig.id },
          data: {
            enableMagicLink: settings.enableMagicLink,
            magicLinkUrl: settings.magicLinkUrl,
            magicLinkEmailSubject: settings.magicLinkEmailSubject,
            magicLinkExpiryHours: settings.magicLinkExpiryHours,
          },
        });

        return {
          enableMagicLink: result.enableMagicLink,
          magicLinkUrl: result.magicLinkUrl,
          magicLinkEmailSubject: result.magicLinkEmailSubject,
          magicLinkExpiryHours: result.magicLinkExpiryHours,
        };
      } catch (error) {
        throw new ApplicationError("Error updating magic link settings", {
          error: error.message,
        });
      }
    },

    async encryptJson(key: string, json: string) {
      const encrypted = CryptoJS.AES.encrypt(json, key).toString();
      return encrypted;
    },
    async decryptJson(key: string, hash: string) {
      const decrypted = CryptoJS.AES.decrypt(hash, key).toString(CryptoJS.enc.Utf8);
      return decrypted;
    },
    async restart() {
      strapi.log.info("*".repeat(100));
      strapi.log.info(SUCCESS_MESSAGES.SERVER_RESTARTING);
      setImmediate(() => strapi.reload());
      strapi.log.info("*".repeat(100));
    },
  };
};

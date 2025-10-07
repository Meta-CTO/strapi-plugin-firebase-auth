import { errors } from "@strapi/utils";
import { Context, DefaultContext } from "koa";
import admin, { ServiceAccount } from "firebase-admin";
import checkValidJson from "../utils/check-valid-json";
import CryptoJS from "crypto-js";

const { ValidationError, ApplicationError } = errors;
export default ({ strapi }) => {
  const encryptionKey = strapi.config.get(
    "plugin::firebase-authentication.FIREBASE_JSON_ENCRYPTION_KEY"
  );

  return {
    async init() {
      try {
        console.log("Starting Firebase initialization...");
        const res = await strapi.db
          .query("plugin::firebase-authentication.firebase-authentication-configuration")
          .findOne({ where: {} });
        console.log("Found config:", !!res);

        if (!res) {
          console.log("No config found, checking for existing Firebase app...");
          if (strapi.firebase) {
            console.log("Deleting existing Firebase app...");
            await strapi.firebase.app().delete();
          }
          return;
        }

        const jsonObject = res["firebase_config_json"];
        console.log("Config JSON present:", !!jsonObject?.firebaseConfigJson);

        if (!jsonObject || !jsonObject.firebaseConfigJson) {
          console.log("No valid JSON config, checking for existing Firebase app...");
          if (strapi.firebase) {
            console.log("Deleting existing Firebase app...");
            await strapi.firebase.app().delete();
          }
          return;
        }

        console.log("Decrypting JSON config...");
        const firebaseConfigJson = await this.decryptJson(encryptionKey, jsonObject.firebaseConfigJson);

        console.log("Validating service account...");
        const serviceAccount = checkValidJson(firebaseConfigJson);
        if (!serviceAccount) {
          console.log("Invalid service account JSON");
          return;
        }

        console.log("Initializing Firebase app...");

        // Check if Firebase app already exists and delete it
        try {
          const existingApp = admin.app();
          if (existingApp) {
            console.log("Deleting existing Firebase app before re-initialization...");
            await existingApp.delete();
            console.log("Existing app deleted");
          }
        } catch (error) {
          // App doesn't exist, which is fine - continue with initialization
          console.log("No existing Firebase app found, proceeding with initialization");
        }

        // Initialize Firebase
        try {
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount as ServiceAccount),
          });
          strapi.firebase = admin;
          console.log("✅ Firebase initialization complete - admin instance attached to strapi.firebase");
        } catch (initError) {
          console.error("❌ Failed to initialize Firebase:", initError);
          throw initError;
        }
      } catch (error) {
        console.error("Firebase bootstrap error:", error);
      }
    },
    /**
     * Retrieves and decrypts the Firebase configuration including Web API key
     *
     * @returns Firebase configuration object or null if not configured
     *
     * @throws ApplicationError - When there's an error retrieving or decrypting the configuration
     *
     * @remarks
     * Returns an object containing:
     * - `firebaseConfigJson`: Decrypted Firebase service account JSON string
     * - `firebaseWebApiKey`: Firebase Web API key for Identity Toolkit API calls
     */
    async getFirebaseConfigJson() {
      const key = encryptionKey;
      try {
        const configObject = await strapi.db
          .query("plugin::firebase-authentication.firebase-authentication-configuration")
          .findOne({ where: {} });

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
          firebaseWebApiKey: configObject["firebase_web_api_key"]
        };
      } catch (error) {
        console.error("Firebase config error:", error);
        throw new errors.ApplicationError("Error retrieving Firebase config", {
          error: error.message,
        });
      }
    },

    /**
     * Stores and encrypts Firebase configuration including Web API key
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
     *
     * The service account JSON is encrypted using AES before storage,
     * while the Web API key is stored in plain text.
     */
    async setFirebaseConfigJson(ctx: DefaultContext | Context) {
      try {
        console.log("setFirebaseConfigJson", ctx.request);
        const { body: requestBody } = ctx.request;
        const firebaseConfigJsonString = requestBody.firebaseConfigJson;
        const firebaseWebApiKey = requestBody.firebaseWebApiKey;

        if (!requestBody) throw new ValidationError("data is missing");

        // Validate Service Account JSON structure
        try {
          const parsedConfig = JSON.parse(firebaseConfigJsonString);
          const requiredFields = ['private_key', 'client_email', 'project_id', 'type'];
          const missingFields = requiredFields.filter(field => !parsedConfig[field]);

          if (missingFields.length > 0) {
            throw new ValidationError(
              `Invalid Service Account JSON. Missing required fields: ${missingFields.join(', ')}. ` +
              `Please download the correct JSON from Firebase Console → Service Accounts → Generate New Private Key. ` +
              `Do NOT use the Web App Config (SDK snippet) - that is a different file!`
            );
          }

          // Additional check: if it has apiKey or authDomain, it's the wrong JSON
          if (parsedConfig.apiKey || parsedConfig.authDomain) {
            throw new ValidationError(
              `You uploaded a Web App Config (SDK snippet) instead of a Service Account JSON. ` +
              `Please go to Firebase Console → Service Accounts tab → Generate New Private Key to download the correct file.`
            );
          }
        } catch (parseError) {
          if (parseError instanceof ValidationError) {
            throw parseError;
          }
          throw new ValidationError("Invalid JSON format. Please ensure you copied the entire JSON content correctly.");
        }

        const hash = await this.encryptJson(encryptionKey, firebaseConfigJsonString);
        const isExist = await strapi.db
          .query("plugin::firebase-authentication.firebase-authentication-configuration")
          .findOne({ where: {} });
        let res: any;
        if (!isExist) {
          res = await strapi.db
            .query("plugin::firebase-authentication.firebase-authentication-configuration")
            .create({
              data: {
                firebase_config_json: { firebaseConfigJson: hash },
                firebase_web_api_key: firebaseWebApiKey
              },
            });
        } else {
          res = await strapi.db
            .query("plugin::firebase-authentication.firebase-authentication-configuration")
            .update({
              where: { id: isExist.id },
              data: {
                firebase_config_json: { firebaseConfigJson: hash },
                firebase_web_api_key: firebaseWebApiKey
              },
            });
        }
        await strapi.plugin("firebase-authentication").service("settingsService").init();
        const firebaseConfigHash = res["firebase_config_json"].firebaseConfigJson;
        const firebaseConfigJsonValue = await this.decryptJson(encryptionKey, firebaseConfigHash);
        res["firebase_config_json"].firebaseConfigJson = firebaseConfigJsonValue;
        res["firebase_web_api_key"] = firebaseWebApiKey;
        return res;
      } catch (error) {
        throw new ApplicationError("some thing went wrong", {
          error: error.message,
        });
      }
    },
    delFirebaseConfigJson: async () => {
      try {
        console.log("delFirebaseConfigJson 🤣");
        const isExist = await strapi.db
          .query("plugin::firebase-authentication.firebase-authentication-configuration")
          .findOne({ where: {} });
        console.log("isExist 🤣", isExist);
        if (!isExist) {
          console.log("No Firebase configs exists for deletion");
          return null;
        }
        const res = await strapi.db
          .query("plugin::firebase-authentication.firebase-authentication-configuration")
          .delete({
            where: { id: isExist.id }
          });
        console.log("res 🤣", res);
        await strapi.plugin("firebase-authentication").service("settingsService").init();
        console.log("res 🤣", res);
        return res;
      } catch (error) {
        console.log("error 🤣", error);
        throw new ApplicationError("some thing went wrong", {
          error: error,
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
      strapi.log.info("SERVER IS RESTARTING");
      setImmediate(() => strapi.reload());
      strapi.log.info("*".repeat(100));
    },
  };
};

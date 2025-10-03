import { errors } from "@strapi/utils";
import { Context, DefaultContext } from "koa";
import admin, { ServiceAccount } from "firebase-admin";
import checkValidJson from "../utils/check-valid-json";
import CryptoJS from "crypto-js";

const { ValidationError, ApplicationError } = errors;
export default ({ strapi }) => {
  const encryptionKey = strapi.plugin("firebase-authentication").config("FIREBASE_JSON_ENCRYPTION_KEY");

  return {
    async init() {
      try {
        console.log("Starting Firebase initialization...");
        const res = await strapi.entityService.findMany(
          "plugin::firebase-authentication.firebase-authentication-configuration"
        );
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
            await strapi.firebase.delete();
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
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount as ServiceAccount),
        });
        strapi.firebase = admin;
        console.log("Firebase initialization complete");
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
        const configObject = await strapi.entityService.findMany(
          "plugin::firebase-authentication.firebase-authentication-configuration"
        );

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

        const hash = await this.encryptJson(encryptionKey, firebaseConfigJsonString);

        if (!requestBody) throw new ValidationError("data is missing");
        const isExist = await strapi.entityService.findMany(
          "plugin::firebase-authentication.firebase-authentication-configuration"
        );
        let res: any;
        if (!isExist) {
          res = await strapi.entityService.create(
            "plugin::firebase-authentication.firebase-authentication-configuration",
            {
              data: {
                firebase_config_json: { firebaseConfigJson: hash },
                firebase_web_api_key: firebaseWebApiKey
              },
            }
          );
        } else {
          res = await strapi.entityService.update(
            "plugin::firebase-authentication.firebase-authentication-configuration",
            isExist.id,
            {
              data: {
                firebase_config_json: { firebaseConfigJson: hash },
                firebase_web_api_key: firebaseWebApiKey
              },
            }
          );
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
        const isExist = await strapi.entityService.findMany(
          "plugin::firebase-authentication.firebase-authentication-configuration"
        );
        console.log("isExist 🤣", isExist);
        if (!isExist) {
          console.log("No Firebase configs exists for deletion");
          return null;
        }
        const res = await strapi.entityService.delete(
          "plugin::firebase-authentication.firebase-authentication-configuration",
          isExist.id
        );
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

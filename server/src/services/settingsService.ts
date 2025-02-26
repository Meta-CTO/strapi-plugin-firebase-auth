import {errors} from "@strapi/utils";
import { Context, DefaultContext } from "koa";
import admin, { ServiceAccount } from "firebase-admin";
import checkValidJson from "../utils/check-valid-json";
import CryptoJS from "crypto-js";

const { ValidationError, ApplicationError } = errors;
export default ({ strapi }) => {
  const encryptionKey = strapi
    .plugin("firebase-auth")
    .config("FIREBASE_JSON_ENCRYPTION_KEY");

  return {
    async init() {
      try {
        console.log('Starting Firebase initialization...');
        const res = await strapi.entityService.findMany(
          "plugin::firebase-auth.firebase-auth-configuration",
        );
        console.log('Found config:', !!res);
        
        if (!res) {
          console.log('No config found, checking for existing Firebase app...');
          if (strapi.firebase) {
            console.log('Deleting existing Firebase app...');
            await strapi.firebase.app().delete();
          }
          return;
        }

        const jsonObject = res["firebase_config_json"];
        console.log('Config JSON present:', !!jsonObject?.firebaseConfigJson);
        
        if (!jsonObject || !jsonObject.firebaseConfigJson) {
          console.log('No valid JSON config, checking for existing Firebase app...');
          if (strapi.firebase) {
            console.log('Deleting existing Firebase app...');
            await strapi.firebase.delete();
          }
          return;
        }

        console.log('Decrypting JSON config...');
        const firebaseConfigJson = await this.decryptJson(
          encryptionKey,
          jsonObject.firebaseConfigJson,
        );

        console.log('Validating service account...');
        const serviceAccount = checkValidJson(firebaseConfigJson);
        if (!serviceAccount) {
          console.log('Invalid service account JSON');
          return;
        }

        console.log('Initializing Firebase app...');
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount as ServiceAccount),
        });
        strapi.firebase = admin;
        console.log('Firebase initialization complete');
      } catch (error) {
        console.error("Firebase bootstrap error:", error);
      }
    },
    async getFirebaseConfigJson() {
      const key = encryptionKey;
      try {
        const configObject = await strapi.entityService.findMany(
          "plugin::firebase-auth.firebase-auth-configuration",
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
        return { firebaseConfigJson };
        
      } catch (error) {
        console.error('Firebase config error:', error);
        throw new errors.ApplicationError("Error retrieving Firebase config", {
          error: error.message,
        });
      }
    },

    async setFirebaseConfigJson(ctx: DefaultContext | Context) {
      try {
        console.log("setFirebaseConfigJson", ctx.request);
        const { body: firebaseConfigJson } = ctx.request;
        const firebaseConfigJsonString = firebaseConfigJson.firebaseConfigJson;

        const hash = await this.encryptJson(
          encryptionKey,
          firebaseConfigJsonString,
        );

        if (!firebaseConfigJson) throw new ValidationError("data is missing");
        const isExist = await strapi.entityService.findMany(
          "plugin::firebase-auth.firebase-auth-configuration",
        );
        let res: any;
        if (!isExist) {
          res = await strapi.entityService.create(
            "plugin::firebase-auth.firebase-auth-configuration",
            {
              data: { "firebase_config_json": { firebaseConfigJson: hash } },
            },
          );
        } else {
          res = await strapi.entityService.update(
            "plugin::firebase-auth.firebase-auth-configuration",
            isExist.id,
            {
              data: {
                "firebase_config_json": { firebaseConfigJson: hash },
              },
            },
          );
        }
        await strapi.plugin("firebase-auth").service("settingsService").init();
        const firebaseConfigHash =
          res["firebase_config_json"].firebaseConfigJson;
        const firebaseConfigJsonValue = await this.decryptJson(
          encryptionKey,
          firebaseConfigHash,
        );
        res["firebase_config_json"].firebaseConfigJson =
          firebaseConfigJsonValue;
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
          "plugin::firebase-auth.firebase-auth-configuration",
        );
        console.log("isExist 🤣", isExist);
        const res = await strapi.entityService.delete(
          "plugin::firebase-auth.firebase-auth-configuration",
          isExist.id,
        );
        console.log("res 🤣", res);
        await strapi.plugin("firebase-auth").service("settingsService").init();
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
      const decrypted = CryptoJS.AES.decrypt(hash, key).toString(
        CryptoJS.enc.Utf8,
      );
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

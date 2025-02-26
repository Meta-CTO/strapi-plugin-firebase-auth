/**
 * Config for Gen Types Plugin
 */
export type FirebaseAuthConfig = {
  /**
   * Any key to encrypt the firebase json file
   *
   * @default 'your-key-here'
   */
  firebaseJsonEncryptionKey: string;

};

export default {
  default: ({ env }) => ({
    firebaseJsonEncryptionKey: env("FIREBASE_JSON_ENCRYPTION_KEY", "your-key-here")
  }),
  validator(config: FirebaseAuthConfig) {
    if (!config.firebaseJsonEncryptionKey) {
      throw new Error("FIREBASE_JSON_ENCRYPTION_KEY is required for Firebase Auth to work");
    }
  },
};

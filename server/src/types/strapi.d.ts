import type * as admin from 'firebase-admin';

declare module '@strapi/strapi' {
  export module Core {
    export interface Strapi {
      firebase: typeof admin;
      plugin: (name: string) => any;
      plugins: Record<string, any>;
      log: {
        error: (message: string, error?: any) => void;
        warn: (message: string) => void;
      };
      db: {
        query: (uid: string) => {
          findOne: (params: any) => Promise<any>;
          create: (params: any) => Promise<any>;
          update: (params: any) => Promise<any>;
        };
      };
      store: (options: {
        environment: string;
        type: string;
        name: string;
      }) => Promise<{
        get: (params: { key: string }) => Promise<any>;
      }>;
    }
  }
}

// Augment the global scope
declare global {
  namespace Strapi {
    interface Strapi {
      firebase: typeof admin;
      plugin: (name: string) => any;
      plugins: Record<string, any>;
    }
  }
} 
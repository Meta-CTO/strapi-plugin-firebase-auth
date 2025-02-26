import type { Core } from '@strapi/strapi';

export interface AdminController {
  strapi: Core.Strapi;
}

export interface FirebaseAuthController {
  strapi: Core.Strapi;
}

export interface DecodedFirebaseToken {
  uid: string;
  email?: string;
  phone_number?: string;
}

export interface ServiceAccount {
  projectId: string;
  clientEmail: string;
  privateKey: string;
} 
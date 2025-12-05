export interface EmailTemplate {
  subject: string;
  html?: string;
  text?: string;
  htmlFile?: string;
  textFile?: string;
}

export interface EmailTemplateConfig {
  passwordReset?: Partial<EmailTemplate>;
  magicLink?: Partial<EmailTemplate>;
  passwordChanged?: Partial<EmailTemplate>;
  // Future templates can be added here
  // welcome?: Partial<EmailTemplate>;
  // emailVerification?: Partial<EmailTemplate>;
}

export interface TemplateVariables {
  user: {
    email: string;
    firstName?: string;
    lastName?: string;
    displayName?: string;
    phoneNumber?: string;
    uid: string;
  };
  link?: string;
  resetLink?: string;
  magicLink?: string;
  changedAt?: string;
  appName: string;
  appUrl: string;
  expiresIn?: string;
  year: number;
  supportEmail?: string;
}

export type TemplateType = "passwordReset" | "magicLink" | "passwordChanged";

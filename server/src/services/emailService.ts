import { errors } from "@strapi/utils";
import _ from "lodash";
import { TemplateVariables, TemplateType } from "../templates/types";

class EmailService {
  /**
   * Send a templated email using Strapi's email service
   * Templates are compiled with Lodash before sending
   */
  async sendTemplatedEmail(
    to: string,
    templateType: TemplateType,
    variables: Partial<TemplateVariables>
  ): Promise<void> {
    try {
      // Get app configuration
      const pluginConfig: any = strapi.config.get("plugin::firebase-authentication");
      const appConfig: any = pluginConfig?.app || {};

      // Build complete template variables for Lodash processing
      const completeVariables: TemplateVariables = {
        ...variables,
        appName: appConfig?.name || "Your Application",
        appUrl: appConfig?.url || process.env.PUBLIC_URL || "http://localhost:3000",
        supportEmail: appConfig?.supportEmail,
        year: new Date().getFullYear(),
        expiresIn: variables.expiresIn || "1 hour",
      } as TemplateVariables;

      // Get template service to fetch the appropriate template
      const templateService = strapi.plugin("firebase-authentication").service("templateService");

      // Get the template (either default or user-configured)
      const template = await templateService.getTemplate(templateType);

      // Validate email content
      if (!template.subject) {
        throw new errors.ValidationError("Email subject is required");
      }

      if (!template.html && !template.text) {
        throw new errors.ValidationError("Email must have either HTML or text content");
      }

      // Compile the templates with Lodash
      const compiledSubject = _.template(template.subject)(completeVariables);
      const compiledHtml = template.html ? _.template(template.html)(completeVariables) : undefined;
      const compiledText = template.text ? _.template(template.text)(completeVariables) : undefined;

      // Check if email plugin exists before trying to use it
      const emailPlugin = strapi.plugin("email");
      if (!emailPlugin) {
        // Fallback to array notation if getter method fails
        if (strapi.plugins && strapi.plugins["email"]) {
          // Use the array notation instead
          await strapi.plugins["email"].services.email.send({
            to,
            subject: compiledSubject,
            html: compiledHtml,
            text: compiledText,
          });
          strapi.log.info(`Email sent successfully to ${to} using template: ${templateType}`);
          return;
        }

        throw new Error("Email plugin not found - ensure email provider is configured in /config/plugins.js");
      }

      const emailService = emailPlugin.service("email");
      if (!emailService) {
        throw new Error("Email service not found in email plugin");
      }

      // Use Strapi's email plugin send method
      await emailService.send({
        to,
        subject: compiledSubject,
        html: compiledHtml,
        text: compiledText,
        // Optional: from, replyTo, cc, bcc can be added here
      });

      strapi.log.info(`Email sent successfully to ${to} using template: ${templateType}`);
    } catch (error: any) {
      strapi.log.debug(`Failed to send email to ${to}: ${error.message}`);
      throw new errors.ApplicationError(`Failed to send email: ${error.message}`);
    }
  }

  /**
   * Send password reset email with three-tier fallback system
   * Tier 1: Strapi Email Plugin (if configured)
   * Tier 2: Custom Hook Function (if provided in config)
   * Tier 3: Development Console Logging (dev mode only)
   */
  async sendPasswordResetEmail(user: any, resetLink: string): Promise<{ success: boolean; message: string }> {
    // Validation
    if (!user.email) {
      throw new errors.ValidationError("User does not have an email address");
    }

    // Build template variables
    const variables: Partial<TemplateVariables> = {
      user: {
        email: user.email,
        firstName: user.firstName || user.displayName?.split(" ")[0],
        lastName: user.lastName,
        displayName: user.displayName,
        phoneNumber: user.phoneNumber,
        uid: user.uid,
      },
      resetLink,
      expiresIn: "1 hour",
    };

    // Get configuration for building complete variables
    const pluginConfig: any = strapi.config.get("plugin::firebase-authentication");
    const appConfig: any = pluginConfig?.app || {};

    // Build complete template variables for compilation
    const completeVariables: TemplateVariables = {
      ...variables,
      appName: appConfig?.name || "Your Application",
      appUrl: appConfig?.url || process.env.PUBLIC_URL || "http://localhost:3000",
      supportEmail: appConfig?.supportEmail,
      year: new Date().getFullYear(),
      expiresIn: variables.expiresIn || "1 hour",
    } as TemplateVariables;

    // TIER 1: Try Strapi email plugin
    try {
      // Send the email without timeout since Ethereal/SMTP can be slow
      await this.sendTemplatedEmail(user.email, "passwordReset", variables);

      strapi.log.info(`✅ Password reset email sent via Strapi email plugin to ${user.email}`);
      return {
        success: true,
        message: `Password reset email sent to ${user.email}`,
      };
    } catch (tier1Error: any) {
      strapi.log.debug(`Strapi email plugin failed: ${tier1Error.message}. Trying fallback options...`);
    }

    // TIER 2: Try custom hook function
    const customSender = pluginConfig?.sendPasswordResetEmail;
    if (customSender && typeof customSender === "function") {
      try {
        // Get template service and template
        const templateService = strapi.plugin("firebase-authentication").service("templateService");
        const template = await templateService.getTemplate("passwordReset");

        // Compile the templates
        const compiledSubject = _.template(template.subject)(completeVariables);
        const compiledHtml = template.html ? _.template(template.html)(completeVariables) : undefined;
        const compiledText = template.text ? _.template(template.text)(completeVariables) : undefined;

        // Call custom sender
        await customSender({
          to: user.email,
          subject: compiledSubject,
          html: compiledHtml,
          text: compiledText,
          resetLink,
          variables: completeVariables,
        });

        strapi.log.info(`✅ Password reset email sent via custom hook to ${user.email}`);
        return {
          success: true,
          message: `Password reset email sent to ${user.email}`,
        };
      } catch (tier2Error: any) {
        strapi.log.error(`Custom hook failed: ${tier2Error.message}. Continuing to next fallback...`);
      }
    }

    // TIER 3: Development fallback
    if (process.env.NODE_ENV !== "production") {
      try {
        // Get template for console display
        const templateService = strapi.plugin("firebase-authentication").service("templateService");
        const template = await templateService.getTemplate("passwordReset");
        const compiledSubject = _.template(template.subject)(completeVariables);

        // Log to console with nice formatting
        // NOTE: This output appears in the SERVER TERMINAL where Strapi is running,
        // not in the browser console. Check your terminal for the password reset link.
        strapi.log.info("\n" + "=".repeat(80));
        strapi.log.info("PASSWORD RESET EMAIL (Development Mode)");
        strapi.log.info("=".repeat(80));
        strapi.log.info(`To: ${user.email}`);
        strapi.log.info(`Subject: ${compiledSubject}`);
        strapi.log.info(`Reset Link: ${resetLink}`);
        strapi.log.info(`Expires In: 1 hour`);
        strapi.log.info("=".repeat(80));
        strapi.log.info("Note: Email not sent - no email service configured");
        strapi.log.info("Configure email provider or use custom hook in production");
        strapi.log.info("=".repeat(80) + "\n");

        return {
          success: true,
          message: "Password reset link logged to console (development mode)",
        };
      } catch (tier3Error: any) {
        strapi.log.error(`Development fallback failed: ${tier3Error.message}`);
      }
    }

    // Production error if no fallback worked
    throw new errors.ValidationError(
      "Email service is not configured. Please configure Strapi email plugin or provide custom sendPasswordResetEmail function in plugin config."
    );
  }

  /**
   * Send magic link email with three-tier fallback system
   * Tier 1: Strapi Email Plugin (if configured)
   * Tier 2: Custom Hook Function (if provided in config)
   * Tier 3: Development Console Logging (dev mode only)
   */
  async sendMagicLinkEmail(
    email: string,
    magicLink: string,
    config: any
  ): Promise<{ success: boolean; message: string }> {
    // Build template variables
    const expiryHours = config?.magicLinkExpiryHours || 1;
    const expiresIn = expiryHours === 1 ? "1 hour" : `${expiryHours} hours`;

    const variables: Partial<TemplateVariables> = {
      user: {
        email,
        uid: "", // Magic links don't require existing user
      },
      magicLink,
      expiresIn,
    };

    // Get configuration for building complete variables
    const pluginConfig: any = strapi.config.get("plugin::firebase-authentication");
    const appConfig: any = pluginConfig?.app || {};

    // Build complete template variables for compilation
    const completeVariables: TemplateVariables = {
      ...variables,
      appName: appConfig?.name || "Your Application",
      appUrl: appConfig?.url || process.env.PUBLIC_URL || "http://localhost:3000",
      supportEmail: appConfig?.supportEmail,
      year: new Date().getFullYear(),
      expiresIn: variables.expiresIn || "1 hour",
    } as TemplateVariables;

    // TIER 1: Try Strapi email plugin
    try {
      // Send the email without timeout since Ethereal/SMTP can be slow
      await this.sendTemplatedEmail(email, "magicLink", variables);

      strapi.log.info(`✅ Magic link email sent via Strapi email plugin to ${email}`);
      return {
        success: true,
        message: `Magic link email sent to ${email}`,
      };
    } catch (tier1Error: any) {
      strapi.log.debug(`Strapi email plugin failed: ${tier1Error.message}. Trying fallback options...`);
    }

    // TIER 2: Try custom hook function
    const customSender = pluginConfig?.sendMagicLinkEmail;
    if (customSender && typeof customSender === "function") {
      try {
        // Get template service and template
        const templateService = strapi.plugin("firebase-authentication").service("templateService");
        const template = await templateService.getTemplate("magicLink");

        // Compile the templates
        const compiledSubject = _.template(template.subject)(completeVariables);
        const compiledHtml = template.html ? _.template(template.html)(completeVariables) : undefined;
        const compiledText = template.text ? _.template(template.text)(completeVariables) : undefined;

        // Call custom sender
        await customSender({
          to: email,
          subject: compiledSubject,
          html: compiledHtml,
          text: compiledText,
          magicLink,
          variables: completeVariables,
        });

        strapi.log.info(`✅ Magic link email sent via custom hook to ${email}`);
        return {
          success: true,
          message: `Magic link email sent to ${email}`,
        };
      } catch (tier2Error: any) {
        strapi.log.error(`Custom hook failed: ${tier2Error.message}. Continuing to next fallback...`);
      }
    }

    // TIER 3: Development fallback
    if (process.env.NODE_ENV !== "production") {
      try {
        // Get template for console display
        const templateService = strapi.plugin("firebase-authentication").service("templateService");
        const template = await templateService.getTemplate("magicLink");
        const compiledSubject = _.template(template.subject)(completeVariables);

        // Log to console with nice formatting
        // NOTE: This output appears in the SERVER TERMINAL where Strapi is running,
        // not in the browser console. Check your terminal for the magic link.
        strapi.log.info("\n" + "=".repeat(80));
        strapi.log.info("MAGIC LINK EMAIL (Development Mode)");
        strapi.log.info("=".repeat(80));
        strapi.log.info(`To: ${email}`);
        strapi.log.info(`Subject: ${compiledSubject}`);
        strapi.log.info(`Magic Link: ${magicLink}`);
        strapi.log.info(`Expires In: ${expiresIn}`);
        strapi.log.info("=".repeat(80));
        strapi.log.info("Note: Email not sent - no email service configured");
        strapi.log.info("Copy the link above and open in your browser to test");
        strapi.log.info("=".repeat(80) + "\n");

        return {
          success: true,
          message: "Magic link logged to console (development mode)",
        };
      } catch (tier3Error: any) {
        strapi.log.error(`Development fallback failed: ${tier3Error.message}`);
      }
    }

    // Production error if no fallback worked
    throw new errors.ValidationError(
      "Email service is not configured. Please configure Strapi email plugin or provide custom sendMagicLinkEmail function in plugin config."
    );
  }

  /**
   * Send password changed confirmation email
   * Notifies user that their password was successfully changed
   * Uses same three-tier fallback system
   */
  async sendPasswordChangedEmail(user: any): Promise<{ success: boolean; message: string }> {
    // Validation
    if (!user.email) {
      throw new errors.ValidationError("User does not have an email address");
    }

    // Build template variables
    const changedAt = new Date().toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });

    const variables: Partial<TemplateVariables> = {
      user: {
        email: user.email,
        firstName: user.firstName || user.displayName?.split(" ")[0],
        lastName: user.lastName,
        displayName: user.displayName,
        phoneNumber: user.phoneNumber,
        uid: user.uid,
      },
      changedAt,
    };

    // Get configuration for building complete variables
    const pluginConfig: any = strapi.config.get("plugin::firebase-authentication");
    const appConfig: any = pluginConfig?.app || {};

    // Build complete template variables for compilation
    const completeVariables: TemplateVariables = {
      ...variables,
      appName: appConfig?.name || "Your Application",
      appUrl: appConfig?.url || process.env.PUBLIC_URL || "http://localhost:3000",
      supportEmail: appConfig?.supportEmail,
      year: new Date().getFullYear(),
    } as TemplateVariables;

    // TIER 1: Try Strapi email plugin
    try {
      await this.sendTemplatedEmail(user.email, "passwordChanged", variables);

      strapi.log.info(`✅ Password changed confirmation email sent to ${user.email}`);
      return {
        success: true,
        message: `Password changed confirmation sent to ${user.email}`,
      };
    } catch (tier1Error: any) {
      strapi.log.debug(`Strapi email plugin failed: ${tier1Error.message}. Trying fallback options...`);
    }

    // TIER 2: Try custom hook function
    const customSender = pluginConfig?.sendPasswordChangedEmail;
    if (customSender && typeof customSender === "function") {
      try {
        // Get template service and template
        const templateService = strapi.plugin("firebase-authentication").service("templateService");
        const template = await templateService.getTemplate("passwordChanged");

        // Compile the templates
        const compiledSubject = _.template(template.subject)(completeVariables);
        const compiledHtml = template.html ? _.template(template.html)(completeVariables) : undefined;
        const compiledText = template.text ? _.template(template.text)(completeVariables) : undefined;

        // Call custom sender
        await customSender({
          to: user.email,
          subject: compiledSubject,
          html: compiledHtml,
          text: compiledText,
          variables: completeVariables,
        });

        strapi.log.info(`✅ Password changed confirmation sent via custom hook to ${user.email}`);
        return {
          success: true,
          message: `Password changed confirmation sent to ${user.email}`,
        };
      } catch (tier2Error: any) {
        strapi.log.error(`Custom hook failed: ${tier2Error.message}. Continuing to next fallback...`);
      }
    }

    // TIER 3: Development fallback (just log, don't block the operation)
    if (process.env.NODE_ENV !== "production") {
      strapi.log.info("\n" + "=".repeat(80));
      strapi.log.info("PASSWORD CHANGED CONFIRMATION (Development Mode)");
      strapi.log.info("=".repeat(80));
      strapi.log.info(`To: ${user.email}`);
      strapi.log.info(`Changed At: ${changedAt}`);
      strapi.log.info("=".repeat(80));
      strapi.log.info("Note: Confirmation email not sent - no email service configured");
      strapi.log.info("=".repeat(80) + "\n");

      return {
        success: true,
        message: "Password changed confirmation logged to console (development mode)",
      };
    }

    // In production, log warning but don't fail the password reset
    strapi.log.warn(
      `Could not send password changed confirmation to ${user.email} - no email service configured`
    );
    return {
      success: false,
      message: "Password changed but confirmation email could not be sent",
    };
  }

  /**
   * Send email verification email with three-tier fallback system
   * Tier 1: Strapi Email Plugin (if configured)
   * Tier 2: Custom Hook Function (if provided in config)
   * Tier 3: Development Console Logging (dev mode only)
   */
  async sendVerificationEmail(
    user: any,
    verificationLink: string
  ): Promise<{ success: boolean; message: string }> {
    // Validation
    if (!user.email) {
      throw new errors.ValidationError("User does not have an email address");
    }

    // Build template variables
    const variables: Partial<TemplateVariables> = {
      user: {
        email: user.email,
        firstName: user.firstName || user.displayName?.split(" ")[0],
        lastName: user.lastName,
        displayName: user.displayName,
        phoneNumber: user.phoneNumber,
        uid: user.uid,
      },
      verificationLink,
      expiresIn: "1 hour",
    };

    // Get database configuration for custom subject
    const settingsService = strapi.plugin("firebase-authentication").service("settingsService");
    const dbConfig = await settingsService.getFirebaseConfigJson();
    const customSubject = dbConfig?.emailVerificationEmailSubject;

    // Get configuration for building complete variables
    const pluginConfig: any = strapi.config.get("plugin::firebase-authentication");
    const appConfig: any = pluginConfig?.app || {};

    // Build complete template variables for compilation
    const completeVariables: TemplateVariables = {
      ...variables,
      appName: appConfig?.name || "Your Application",
      appUrl: appConfig?.url || process.env.PUBLIC_URL || "http://localhost:3000",
      supportEmail: appConfig?.supportEmail,
      year: new Date().getFullYear(),
      expiresIn: variables.expiresIn || "1 hour",
    } as TemplateVariables;

    // Get template service
    const templateService = strapi.plugin("firebase-authentication").service("templateService");
    const template = await templateService.getTemplate("emailVerification");

    // Use custom subject from database if set, otherwise use template default
    const subjectTemplate = customSubject || template.subject;
    const compiledSubject = _.template(subjectTemplate)(completeVariables);

    // TIER 1: Try Strapi email plugin
    try {
      const compiledHtml = template.html ? _.template(template.html)(completeVariables) : undefined;
      const compiledText = template.text ? _.template(template.text)(completeVariables) : undefined;

      // Check if email plugin exists before trying to use it
      const emailPlugin = strapi.plugin("email");
      if (!emailPlugin) {
        throw new Error("Email plugin not found");
      }

      const emailService = emailPlugin.service("email");
      await emailService.send({
        to: user.email,
        subject: compiledSubject,
        html: compiledHtml,
        text: compiledText,
      });

      strapi.log.info(`✅ Email verification sent via Strapi email plugin to ${user.email}`);
      return {
        success: true,
        message: `Verification email sent to ${user.email}`,
      };
    } catch (tier1Error: any) {
      strapi.log.debug(`Strapi email plugin failed: ${tier1Error.message}. Trying fallback options...`);
    }

    // TIER 2: Try custom hook function
    const customSender = pluginConfig?.sendVerificationEmail;
    if (customSender && typeof customSender === "function") {
      try {
        // Compile the templates
        const compiledHtml = template.html ? _.template(template.html)(completeVariables) : undefined;
        const compiledText = template.text ? _.template(template.text)(completeVariables) : undefined;

        // Call custom sender
        await customSender({
          to: user.email,
          subject: compiledSubject,
          html: compiledHtml,
          text: compiledText,
          verificationLink,
          variables: completeVariables,
        });

        strapi.log.info(`✅ Email verification sent via custom hook to ${user.email}`);
        return {
          success: true,
          message: `Verification email sent to ${user.email}`,
        };
      } catch (tier2Error: any) {
        strapi.log.error(`Custom hook failed: ${tier2Error.message}. Continuing to next fallback...`);
      }
    }

    // TIER 3: Development fallback
    if (process.env.NODE_ENV !== "production") {
      try {
        // Log to console with nice formatting
        // NOTE: This output appears in the SERVER TERMINAL where Strapi is running,
        // not in the browser console. Check your terminal for the verification link.
        strapi.log.info("\n" + "=".repeat(80));
        strapi.log.info("EMAIL VERIFICATION (Development Mode)");
        strapi.log.info("=".repeat(80));
        strapi.log.info(`To: ${user.email}`);
        strapi.log.info(`Subject: ${compiledSubject}`);
        strapi.log.info(`Verification Link: ${verificationLink}`);
        strapi.log.info(`Expires In: 1 hour`);
        strapi.log.info("=".repeat(80));
        strapi.log.info("Note: Email not sent - no email service configured");
        strapi.log.info("Copy the link above and open in your browser to verify");
        strapi.log.info("=".repeat(80) + "\n");

        return {
          success: true,
          message: "Verification link logged to console (development mode)",
        };
      } catch (tier3Error: any) {
        strapi.log.error(`Development fallback failed: ${tier3Error.message}`);
      }
    }

    // Production error if no fallback worked
    throw new errors.ValidationError(
      "Email service is not configured. Please configure Strapi email plugin or provide custom sendVerificationEmail function in plugin config."
    );
  }
}

export default ({ strapi }: { strapi: any }) => new EmailService();

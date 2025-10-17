import { errors } from "@strapi/utils";
import * as fs from "fs/promises";
import * as path from "path";
import _ from "lodash";
import { EmailTemplate, EmailTemplateConfig, TemplateVariables, TemplateType } from "../templates/types";
import { passwordResetTemplate } from "../templates/defaults/password-reset";

const defaultTemplates: Record<TemplateType, EmailTemplate> = {
  passwordReset: passwordResetTemplate,
};

class TemplateService {
  /**
   * Get template with user overrides from configuration
   */
  async getTemplate(templateType: TemplateType): Promise<EmailTemplate> {
    // Get user configuration
    const pluginConfig: any = strapi.config.get("plugin::firebase-authentication");
    const emailTemplates = pluginConfig?.emailTemplates;
    const userTemplate = emailTemplates?.[templateType];

    // Get default template
    const defaultTemplate = defaultTemplates[templateType];

    if (!defaultTemplate) {
      throw new errors.ApplicationError(`Unknown template type: ${templateType}`);
    }

    // If no user customization, return default
    if (!userTemplate) {
      return defaultTemplate;
    }

    // Merge user template with default
    const mergedTemplate: EmailTemplate = { ...defaultTemplate };

    // Handle file-based templates
    if (userTemplate.htmlFile) {
      try {
        const htmlPath = path.resolve(userTemplate.htmlFile);
        mergedTemplate.html = await fs.readFile(htmlPath, "utf-8");
      } catch (error: any) {
        strapi.log.warn(
          `Failed to load HTML template from ${userTemplate.htmlFile}: ${error.message}. ` +
            `Using default template.`
        );
      }
    } else if (userTemplate.html !== undefined) {
      mergedTemplate.html = userTemplate.html;
    }

    if (userTemplate.textFile) {
      try {
        const textPath = path.resolve(userTemplate.textFile);
        mergedTemplate.text = await fs.readFile(textPath, "utf-8");
      } catch (error: any) {
        strapi.log.warn(
          `Failed to load text template from ${userTemplate.textFile}: ${error.message}. ` +
            `Using default template.`
        );
      }
    } else if (userTemplate.text !== undefined) {
      mergedTemplate.text = userTemplate.text;
    }

    // Override subject if provided
    if (userTemplate.subject !== undefined) {
      mergedTemplate.subject = userTemplate.subject;
    }

    return mergedTemplate;
  }

  /**
   * Compile a template string using Lodash
   * Uses Lodash default delimiters: <%= %>
   */
  compileTemplate(templateString: string): _.TemplateExecutor {
    return _.template(templateString);
  }

  /**
   * Validate that required variables are present
   */
  validateVariables(variables: Partial<TemplateVariables>, required: string[]): void {
    const missing = required.filter((key) => {
      const keys = key.split(".");
      let value: any = variables;
      for (const k of keys) {
        value = value?.[k];
        if (value === undefined) return true;
      }
      return false;
    });

    if (missing.length > 0) {
      throw new errors.ValidationError(`Missing required template variables: ${missing.join(", ")}`);
    }
  }
}

export default ({ strapi }: { strapi: any }) => new TemplateService();

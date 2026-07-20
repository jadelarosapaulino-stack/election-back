import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as Handlebars from 'handlebars';
import { EMAIL_TEMPLATE_SEEDS } from '../../system-config/seeds/email-config.seed';
import { SystemConfigService } from '../../system-config/system-config.service';

export interface EmailTemplateData {
  [key: string]: unknown;
}

@Injectable()
export class EmailTemplateService implements OnModuleInit {
  private readonly logger = new Logger(EmailTemplateService.name);
  private readonly compiledTemplates = new Map<
    string,
    HandlebarsTemplateDelegate
  >();

  constructor(private readonly systemConfigService: SystemConfigService) {}

  async onModuleInit(): Promise<void> {
    this.registerDefaultTemplates();
    await this.loadTemplatesFromDB();
  }

  /**
   * The seed catalog is also the runtime fallback. This keeps the template
   * shown in System Config aligned with the one used if the database is not
   * available or a template has not been created yet.
   */
  private registerDefaultTemplates(): void {
    for (const template of EMAIL_TEMPLATE_SEEDS) {
      this.register(template.name, template.htmlBody);
    }

    this.logger.log(
      `Registered ${this.compiledTemplates.size} default email templates`,
    );
  }

  private async loadTemplatesFromDB(): Promise<void> {
    const templates = await this.systemConfigService.getTemplates();

    for (const template of templates) {
      this.register(template.name, template.htmlBody);
    }

    this.logger.log(
      `Loaded ${templates.length} email templates from database (total compiled: ${this.compiledTemplates.size})`,
    );
  }

  private register(name: string, template: string): void {
    try {
      this.compiledTemplates.set(name, Handlebars.compile(template));
    } catch (error) {
      this.logger.error(`Failed to compile template "${name}": ${error}`);
    }
  }

  async render(name: string, data: EmailTemplateData): Promise<string> {
    let compiled = this.compiledTemplates.get(name);

    if (!compiled) {
      const template = await this.systemConfigService.getTemplate(name);
      if (!template) {
        this.logger.warn(`Template "${name}" not found`);
        return '';
      }

      try {
        compiled = Handlebars.compile(template.htmlBody);
        this.compiledTemplates.set(name, compiled);
      } catch (error) {
        this.logger.error(`Failed to compile template "${name}": ${error}`);
        return '';
      }
    }

    return compiled(data);
  }

  async getSubject(name: string, data: EmailTemplateData): Promise<string> {
    const template = await this.systemConfigService.getTemplate(name);
    const subject =
      template?.subject ??
      EMAIL_TEMPLATE_SEEDS.find((item) => item.name === name)?.subject;

    if (!subject) {
      this.logger.warn(`Subject for template "${name}" not found`);
      return '';
    }

    try {
      return Handlebars.compile(subject)(data);
    } catch (error) {
      this.logger.error(`Failed to compile subject for "${name}": ${error}`);
      return subject;
    }
  }

  async refreshTemplates(): Promise<void> {
    this.registerDefaultTemplates();
    await this.loadTemplatesFromDB();
  }

  getTemplateNames(): string[] {
    return Array.from(this.compiledTemplates.keys());
  }
}

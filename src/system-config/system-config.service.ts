import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as nodemailer from 'nodemailer';
import { Repository } from 'typeorm';
import { SystemConfig } from './entities/system-config.entity';
import { EmailTemplateConfig } from './entities/email-template-config.entity';
import { SmtpProvider } from './entities/smtp-provider.entity';
import { CreateSmtpProviderDto } from './dto/create-smtp-provider.dto';
import { UpdateSmtpProviderDto } from './dto/update-smtp-provider.dto';
import {
  Aes256GcmEncryptedPayload,
  Aes256GcmService,
} from '../common/security/aes-256-gcm.service';

export interface EmailSmtpConfig {
  enabled: boolean;
  host: string;
  port: number;
  user: string;
  pass: string;
  secure: boolean;
  requireTls: boolean;
  fromName: string;
  fromEmail: string;
}

export interface EmailSmtpPublicConfig extends Omit<EmailSmtpConfig, 'pass'> {
  pass: '';
  passConfigured: boolean;
}

export interface EmailSmtpProviderPublic extends Omit<SmtpProvider, 'pass'> {
  pass: '';
  passConfigured: boolean;
}

export interface EmailRedisConfig {
  host: string;
  port: number;
  password: string;
}

@Injectable()
export class SystemConfigService implements OnModuleInit {
  private readonly logger = new Logger(SystemConfigService.name);
  private readonly configCache = new Map<string, string>();
  private readonly templateCache = new Map<string, EmailTemplateConfig>();

  constructor(
    @InjectRepository(SystemConfig)
    private readonly configRepo: Repository<SystemConfig>,
    @InjectRepository(EmailTemplateConfig)
    private readonly templateRepo: Repository<EmailTemplateConfig>,
    @InjectRepository(SmtpProvider)
    private readonly smtpProviderRepo: Repository<SmtpProvider>,
    private readonly aes: Aes256GcmService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.loadCache();
    this.logger.log(
      `SystemConfig loaded: ${this.configCache.size} configs, ${this.templateCache.size} templates`,
    );
  }

  // ─── Cache management ───────────────────────────────────────

  private async loadCache(): Promise<void> {
    const configs = await this.configRepo.find({ where: { active: true } });
    this.configCache.clear();
    for (const config of configs) {
      if (config.value !== null) {
        this.configCache.set(`${config.group}.${config.key}`, config.value);
      }
    }

    const templates = await this.templateRepo.find({
      where: { active: true },
    });
    this.templateCache.clear();
    for (const template of templates) {
      this.templateCache.set(template.name, template);
    }
  }

  async refreshCache(): Promise<void> {
    await this.loadCache();
    this.logger.log('SystemConfig cache refreshed');
  }

  // ─── Generic config CRUD ────────────────────────────────────

  async getConfig(group: string, key: string): Promise<string | null> {
    const cacheKey = `${group}.${key}`;
    if (this.configCache.has(cacheKey)) {
      return this.configCache.get(cacheKey)!;
    }

    const config = await this.configRepo.findOne({
      where: { group, key, active: true },
    });
    if (config && config.value !== null) {
      this.configCache.set(cacheKey, config.value);
      return config.value;
    }
    return null;
  }

  async getConfigValue(
    group: string,
    key: string,
    defaultValue: string,
  ): Promise<string> {
    const value = await this.getConfig(group, key);
    return value ?? defaultValue;
  }

  async setConfig(
    group: string,
    key: string,
    value: string,
    description?: string,
  ): Promise<SystemConfig> {
    let config = await this.configRepo.findOne({ where: { group, key } });

    if (config) {
      config.value = value;
      if (description !== undefined) {
        config.description = description;
      }
      config.active = true;
    } else {
      config = this.configRepo.create({
        group,
        key,
        value,
        description: description ?? null,
        active: true,
      });
    }

    const saved = await this.configRepo.save(config);
    this.configCache.set(`${group}.${key}`, value);
    return saved;
  }

  /**
   * Idempotent config setter: only inserts if the key does not already exist.
   * Used by seed services to avoid overwriting user-modified values.
   */
  async seedConfig(
    group: string,
    key: string,
    value: string,
    description?: string,
  ): Promise<void> {
    const existing = await this.configRepo.findOne({
      where: { group, key },
    });
    if (existing) {
      return;
    }

    const config = this.configRepo.create({
      group,
      key,
      value,
      description: description ?? null,
      active: true,
    });
    await this.configRepo.save(config);
    this.configCache.set(`${group}.${key}`, value);
  }

  async deleteConfig(group: string, key: string): Promise<void> {
    await this.configRepo.update({ group, key }, { active: false });
    this.configCache.delete(`${group}.${key}`);
  }

  async getConfigsByGroup(group: string): Promise<SystemConfig[]> {
    return this.configRepo.find({
      where: { group, active: true },
      order: { key: 'ASC' },
    });
  }

  // ─── Email SMTP config helpers ──────────────────────────────

  async getEmailSmtpConfig(): Promise<EmailSmtpConfig> {
    const provider = await this.smtpProviderRepo.findOne({
      where: { isDefault: true },
    });
    if (provider) return this.toSmtpConfig(provider);

    return {
      enabled:
        (await this.getConfigValue('email_smtp', 'enabled', 'false')) ===
        'true',
      host: await this.getConfigValue('email_smtp', 'host', ''),
      port: parseInt(
        await this.getConfigValue('email_smtp', 'port', '587'),
        10,
      ),
      user: await this.getConfigValue('email_smtp', 'user', ''),
      pass: await this.getConfigValue('email_smtp', 'pass', ''),
      secure:
        (await this.getConfigValue('email_smtp', 'secure', 'false')) === 'true',
      requireTls:
        (await this.getConfigValue('email_smtp', 'requireTls', 'true')) ===
        'true',
      fromName: await this.getConfigValue(
        'email_smtp',
        'fromName',
        'Voting Suite',
      ),
      fromEmail: await this.getConfigValue(
        'email_smtp',
        'fromEmail',
        'no-reply@votingsuite.com',
      ),
    };
  }

  async getEmailSmtpPublicConfig(): Promise<EmailSmtpPublicConfig> {
    const config = await this.getEmailSmtpConfig();
    return {
      ...config,
      pass: '',
      passConfigured: Boolean(config.pass),
    };
  }

  async ensureLegacySmtpProvider(): Promise<void> {
    if ((await this.smtpProviderRepo.count()) > 0) {
      await this.encryptLegacySmtpPasswords();
      return;
    }

    const legacy = await this.getLegacyEmailSmtpConfig();
    await this.smtpProviderRepo.save(
      this.smtpProviderRepo.create({
        name: 'Proveedor principal',
        providerType: 'custom',
        isDefault: true,
        ...legacy,
        pass: this.encryptSmtpPassword(legacy.pass),
      }),
    );
  }

  async getSmtpProviders(): Promise<EmailSmtpProviderPublic[]> {
    const providers = await this.smtpProviderRepo.find({
      order: { isDefault: 'DESC', createdAt: 'ASC' },
    });
    return providers.map((provider) => this.toPublicSmtpProvider(provider));
  }

  async createSmtpProvider(
    dto: CreateSmtpProviderDto,
  ): Promise<EmailSmtpProviderPublic> {
    const provider = this.smtpProviderRepo.create({
      ...dto,
      pass: this.encryptSmtpPassword(dto.pass ?? ''),
      isDefault: (await this.smtpProviderRepo.count()) === 0,
    });
    const saved = await this.smtpProviderRepo.save(provider);
    return this.toPublicSmtpProvider(saved);
  }

  async updateDefaultSmtpProvider(
    dto: Partial<EmailSmtpConfig>,
  ): Promise<EmailSmtpPublicConfig> {
    await this.ensureLegacySmtpProvider();
    const provider = await this.smtpProviderRepo.findOneOrFail({
      where: { isDefault: true },
    });
    const updates = { ...dto };
    if (updates.pass === '') delete updates.pass;
    else if (updates.pass)
      updates.pass = this.encryptSmtpPassword(updates.pass);
    Object.assign(provider, updates);
    await this.smtpProviderRepo.save(provider);
    return this.getEmailSmtpPublicConfig();
  }

  async updateSmtpProvider(
    id: string,
    dto: UpdateSmtpProviderDto,
  ): Promise<EmailSmtpProviderPublic> {
    const provider = await this.getSmtpProviderOrFail(id);
    const updates = { ...dto };
    if (updates.pass === '') delete updates.pass;
    else if (updates.pass)
      updates.pass = this.encryptSmtpPassword(updates.pass);
    Object.assign(provider, updates);
    const saved = await this.smtpProviderRepo.save(provider);
    return this.toPublicSmtpProvider(saved);
  }

  async activateSmtpProvider(id: string): Promise<EmailSmtpProviderPublic> {
    await this.smtpProviderRepo.manager.transaction(async (manager) => {
      const repository = manager.getRepository(SmtpProvider);
      const provider = await repository.findOne({ where: { id } });
      if (!provider) {
        throw new BadRequestException('El proveedor SMTP no existe.');
      }
      if (!provider.host || !provider.fromEmail) {
        throw new BadRequestException(
          'Completa el servidor y el remitente antes de activar el proveedor.',
        );
      }
      await repository
        .createQueryBuilder()
        .update(SmtpProvider)
        .set({ isDefault: false })
        .where('"isDefault" = true')
        .execute();
      provider.isDefault = true;
      provider.enabled = true;
      await repository.save(provider);
    });
    return this.toPublicSmtpProvider(await this.getSmtpProviderOrFail(id));
  }

  async deleteSmtpProvider(id: string): Promise<void> {
    const provider = await this.getSmtpProviderOrFail(id);
    if (provider.isDefault) {
      throw new BadRequestException(
        'Selecciona otro proveedor principal antes de eliminar este.',
      );
    }
    await this.smtpProviderRepo.remove(provider);
  }

  async testEmailSmtpConfig(
    recipient?: string,
    providerId?: string,
  ): Promise<{
    success: true;
    message: string;
    latencyMs: number;
  }> {
    const smtpConfig = providerId
      ? this.toSmtpConfig(await this.getSmtpProviderOrFail(providerId))
      : await this.getEmailSmtpConfig();
    if (!smtpConfig.host) {
      throw new BadRequestException(
        'Configura y guarda el servidor SMTP antes de probar la conexión.',
      );
    }

    const startedAt = Date.now();
    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      requireTLS: smtpConfig.requireTls,
      auth:
        smtpConfig.user || smtpConfig.pass
          ? { user: smtpConfig.user, pass: smtpConfig.pass }
          : undefined,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });

    try {
      await transporter.verify();
      if (recipient) {
        await transporter.sendMail({
          from: `"${smtpConfig.fromName}" <${smtpConfig.fromEmail}>`,
          to: recipient,
          subject: 'Prueba de configuración SMTP - Voting Suite',
          text: 'La configuración SMTP de Voting Suite funciona correctamente.',
          html: '<p>La configuración SMTP de <strong>Voting Suite</strong> funciona correctamente.</p>',
        });
      }

      return {
        success: true,
        message: recipient
          ? `Correo de prueba enviado a ${recipient}.`
          : 'Conexión SMTP verificada correctamente.',
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      this.logger.warn(
        `SMTP verification failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      throw new BadRequestException(
        'No se pudo establecer la conexión SMTP. Revisa el host, puerto, seguridad y credenciales.',
      );
    } finally {
      transporter.close();
    }
  }

  private async getLegacyEmailSmtpConfig(): Promise<EmailSmtpConfig> {
    return {
      enabled:
        (await this.getConfigValue('email_smtp', 'enabled', 'false')) ===
        'true',
      host: await this.getConfigValue('email_smtp', 'host', ''),
      port: parseInt(
        await this.getConfigValue('email_smtp', 'port', '587'),
        10,
      ),
      user: await this.getConfigValue('email_smtp', 'user', ''),
      pass: await this.getConfigValue('email_smtp', 'pass', ''),
      secure:
        (await this.getConfigValue('email_smtp', 'secure', 'false')) === 'true',
      requireTls:
        (await this.getConfigValue('email_smtp', 'requireTls', 'true')) ===
        'true',
      fromName: await this.getConfigValue(
        'email_smtp',
        'fromName',
        'Voting Suite',
      ),
      fromEmail: await this.getConfigValue(
        'email_smtp',
        'fromEmail',
        'no-reply@votingsuite.com',
      ),
    };
  }

  private toSmtpConfig(provider: SmtpProvider): EmailSmtpConfig {
    return {
      enabled: provider.enabled,
      host: provider.host,
      port: provider.port,
      user: provider.user,
      pass: this.decryptSmtpPassword(provider.pass),
      secure: provider.secure,
      requireTls: provider.requireTls,
      fromName: provider.fromName,
      fromEmail: provider.fromEmail,
    };
  }

  private toPublicSmtpProvider(
    provider: SmtpProvider,
  ): EmailSmtpProviderPublic {
    return {
      ...provider,
      pass: '',
      passConfigured: Boolean(provider.pass),
    };
  }

  private async getSmtpProviderOrFail(id: string): Promise<SmtpProvider> {
    const provider = await this.smtpProviderRepo.findOne({ where: { id } });
    if (!provider) {
      throw new BadRequestException('El proveedor SMTP no existe.');
    }
    return provider;
  }

  private encryptSmtpPassword(password: string): string {
    if (!password) return '';
    return JSON.stringify(this.aes.encryptJson({ value: password }));
  }

  private decryptSmtpPassword(stored: string): string {
    if (!stored) return '';
    try {
      const payload = JSON.parse(stored) as Aes256GcmEncryptedPayload;
      if (
        payload.alg === 'AES-256-GCM' &&
        payload.iv &&
        payload.tag &&
        payload.ciphertext
      ) {
        return this.aes.decryptJson<{ value: string }>(payload).value;
      }
    } catch {
      // Backward compatibility with legacy plaintext credentials.
    }
    return stored;
  }

  private async encryptLegacySmtpPasswords(): Promise<void> {
    const providers = await this.smtpProviderRepo.find();
    for (const provider of providers) {
      if (!provider.pass || this.isEncryptedSmtpPassword(provider.pass))
        continue;
      provider.pass = this.encryptSmtpPassword(provider.pass);
      await this.smtpProviderRepo.save(provider);
    }
  }

  private isEncryptedSmtpPassword(stored: string): boolean {
    try {
      const payload = JSON.parse(stored) as Aes256GcmEncryptedPayload;
      return (
        payload.alg === 'AES-256-GCM' &&
        Boolean(payload.iv && payload.tag && payload.ciphertext)
      );
    } catch {
      return false;
    }
  }

  // ─── Email Redis config helpers ─────────────────────────────

  async getEmailRedisConfig(): Promise<EmailRedisConfig> {
    return {
      host: await this.getConfigValue(
        'email_redis',
        'host',
        process.env.EMAIL_REDIS_HOST || 'localhost',
      ),
      port: parseInt(
        await this.getConfigValue(
          'email_redis',
          'port',
          process.env.EMAIL_REDIS_PORT || '6379',
        ),
        10,
      ),
      password: await this.getConfigValue(
        'email_redis',
        'password',
        process.env.EMAIL_REDIS_PASSWORD || '',
      ),
    };
  }

  // ─── Template CRUD ──────────────────────────────────────────

  async getTemplate(name: string): Promise<EmailTemplateConfig | null> {
    if (this.templateCache.has(name)) {
      return this.templateCache.get(name)!;
    }

    const template = await this.templateRepo.findOne({
      where: { name, active: true },
    });
    if (template) {
      this.templateCache.set(name, template);
    }
    return template;
  }

  async getTemplates(): Promise<EmailTemplateConfig[]> {
    return this.templateRepo.find({
      where: { active: true },
      order: { name: 'ASC' },
    });
  }

  async saveTemplate(
    name: string,
    subject: string,
    htmlBody: string,
  ): Promise<EmailTemplateConfig> {
    let template = await this.templateRepo.findOne({ where: { name } });

    if (template) {
      template.subject = subject;
      template.htmlBody = htmlBody;
      template.version += 1;
      template.active = true;
    } else {
      template = this.templateRepo.create({
        name,
        subject,
        htmlBody,
        active: true,
        version: 1,
      });
    }

    const saved = await this.templateRepo.save(template);
    this.templateCache.set(name, saved);
    return saved;
  }

  /**
   * Idempotent template setter: only inserts if name does not already exist.
   */
  async seedTemplate(
    name: string,
    subject: string,
    htmlBody: string,
  ): Promise<void> {
    const existing = await this.templateRepo.findOne({ where: { name } });
    if (existing) {
      return;
    }

    const template = this.templateRepo.create({
      name,
      subject,
      htmlBody,
      active: true,
      version: 1,
    });
    const saved = await this.templateRepo.save(template);
    this.templateCache.set(name, saved);
  }

  async deleteTemplate(name: string): Promise<void> {
    await this.templateRepo.update({ name }, { active: false });
    this.templateCache.delete(name);
  }
}

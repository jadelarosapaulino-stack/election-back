import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SystemConfigService } from './system-config.service';
import {
  EMAIL_SMTP_SEEDS,
  EMAIL_REDIS_SEEDS,
  EMAIL_TEMPLATE_SEEDS,
} from './seeds/email-config.seed';

@Injectable()
export class SystemConfigSeedService implements OnModuleInit {
  private readonly logger = new Logger(SystemConfigSeedService.name);

  constructor(private readonly configService: SystemConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.seedEmailConfig();
  }

  private async seedEmailConfig(): Promise<void> {
    this.logger.log('Seeding email configuration…');

    for (const seed of EMAIL_SMTP_SEEDS) {
      await this.configService.seedConfig(
        seed.group,
        seed.key,
        seed.value ?? '',
        seed.description ?? undefined,
      );
    }

    await this.configService.ensureLegacySmtpProvider();

    for (const seed of EMAIL_REDIS_SEEDS) {
      await this.configService.seedConfig(
        seed.group,
        seed.key,
        seed.value ?? '',
        seed.description ?? undefined,
      );
    }

    for (const seed of EMAIL_TEMPLATE_SEEDS) {
      await this.configService.seedTemplate(
        seed.name,
        seed.subject,
        seed.htmlBody,
      );
    }

    this.logger.log('Email configuration seeded successfully');
  }
}

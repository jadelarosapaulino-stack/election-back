import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemConfig } from './entities/system-config.entity';
import { EmailTemplateConfig } from './entities/email-template-config.entity';
import { SystemConfigService } from './system-config.service';
import { SystemConfigController } from './system-config.controller';
import { SystemConfigSeedService } from './system-config-seed.service';
import { SmtpProvider } from './entities/smtp-provider.entity';
import { Aes256GcmService } from '../common/security/aes-256-gcm.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SystemConfig, EmailTemplateConfig, SmtpProvider]),
  ],
  controllers: [SystemConfigController],
  providers: [SystemConfigService, SystemConfigSeedService, Aes256GcmService],
  exports: [SystemConfigService],
})
export class SystemConfigModule {}

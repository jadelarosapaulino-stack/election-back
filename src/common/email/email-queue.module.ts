import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailDelivery } from './entities/email-delivery.entity';
import { EmailTemplateService } from './email-template.service';
import { EmailProcessor } from './email.processor';
import { EmailQueueService } from './email-queue.service';
import { SystemConfigModule } from '../../system-config/system-config.module';
import { SystemConfigService } from '../../system-config/system-config.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([EmailDelivery]),
    SystemConfigModule,
    BullModule.forRootAsync({
      imports: [SystemConfigModule],
      inject: [SystemConfigService],
      useFactory: async (
        configService: SystemConfigService,
      ) => {
        const redisConfig =
          await configService.getEmailRedisConfig();
        return {
          redis: {
            host: redisConfig.host,
            port: redisConfig.port,
            password: redisConfig.password || undefined,
          },
        };
      },
    }),
    BullModule.registerQueue({
      name: 'email-send',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    }),
  ],
  providers: [EmailTemplateService, EmailProcessor, EmailQueueService],
  exports: [EmailTemplateService, EmailQueueService],
})
export class EmailQueueModule {}

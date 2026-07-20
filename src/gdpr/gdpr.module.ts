import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { BreachEvent } from './breach-event.entity';
import { ProcessingRecord } from './processing-record.entity';
import { DpiaRecord } from './dpia-record.entity';
import { DpaRecord } from './dpa-record.entity';
import { UserConsent } from '../auth/entities/user-consent.entity';
import { BreachNotificationService } from './breach-notification.service';
import { ProcessingRecordService } from './processing-record.service';
import { DpiaService } from './dpia.service';
import { DpaService } from './dpa.service';
import { CookieConsentService } from './cookie-consent.service';
import { GdprController } from './gdpr.controller';
import { GdprHealthController } from './gdpr-health.controller';
import { CookieConsentController } from './cookie-consent.controller';
import { AuditLogInterceptor } from './audit-log.interceptor';
import { DpoGuard } from './guards/dpo.guard';
import { BreachCheckScheduler } from './breach-check.scheduler';
import { CommonModule } from '../common/common.module';
import { TimelineModule } from '../timeline/timeline.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    ConfigModule,
    CommonModule,
    TimelineModule,
    AuthModule,
    TypeOrmModule.forFeature([
      BreachEvent,
      ProcessingRecord,
      DpiaRecord,
      DpaRecord,
      UserConsent,
    ]),
  ],
  controllers: [GdprController, GdprHealthController, CookieConsentController],
  providers: [
    Reflector,
    DpoGuard,
    BreachNotificationService,
    ProcessingRecordService,
    DpiaService,
    DpaService,
    CookieConsentService,
    BreachCheckScheduler,
    AuditLogInterceptor,
  ],
  exports: [
    BreachNotificationService,
    ProcessingRecordService,
    DpiaService,
    DpaService,
    CookieConsentService,
    AuditLogInterceptor,
  ],
})
export class GdprModule {}

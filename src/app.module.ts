import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { ProductsModule } from './products/products.module';
import { SeedModule } from './seed/seed.module';
import { FilesModule } from './files/files.module';
import { AuthModule } from './auth/auth.module';
import { ElectionsModule } from './elections/elections.module';
import { QuestionsModule } from './questions/questions.module';
import { OptionsModule } from './options/options.module';
import { UtilsModule } from './utils/utils.module';
import { VotersModule } from './voters/voters.module';
import { CommonModule } from './common/common.module';
import { VoteModule } from './vote/vote.module';
import { TimelineModule } from './timeline/timeline.module';
import { MongooseModule } from '@nestjs/mongoose';
import { TenantsModule } from './tenants/user-settings.module';
import { TenantMiddleware } from './tenants/middleware/users-settings.middleware';
import { RealtimeModule } from './realtime/realtime.module';
import { BillingModule } from './billing/billing.module';
import { SmsPlansModule } from './sms-plans/sms-plans.module';
import { CatalogsModule } from './catalogs/catalogs.module';
import { AuditModule } from './audit/audit.module';
import { TwilioModule } from './twilio/twilio.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { PaymentsAdminModule } from './payments-admin/payments-admin.module';
import { DataRetentionService } from './common/services/data-retention.service';
import { Voter } from './voters/entities/voter.entity';
import { User } from './auth/entities/user.entity';
import { PricingConfigModule } from './pricing-config/pricing-config.module';
import { LandingContentModule } from './landing-content/landing-content.module';
import { GdprModule } from './gdpr/gdpr.module';
import { SystemConfigModule } from './system-config/system-config.module';
import { ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ConfigModule.forRoot(),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: +process.env.DB_PORT,
      database: process.env.DB_NAME,
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      autoLoadEntities: true,
      synchronize:
        process.env.NODE_ENV !== 'production' ||
        process.env.DB_SYNCHRONIZE === 'true',
    }),
    TypeOrmModule.forFeature([Voter, User]),
    MongooseModule.forRoot(process.env.MONGO_URI),
    ProductsModule,
    CommonModule,
    SeedModule,
    FilesModule,
    AuthModule,
    QuestionsModule,
    OptionsModule,
    UtilsModule,
    VotersModule,
    VoteModule,
    TimelineModule,
    ElectionsModule,
    TenantsModule,
    RealtimeModule,
    BillingModule,
    SmsPlansModule,
    TwilioModule,
    CatalogsModule,
    AuditModule,
    MonitoringModule,
    PaymentsAdminModule,
    PricingConfigModule,
    LandingContentModule,
    GdprModule,
    SystemConfigModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    DataRetentionService,
  ],
})
export class AppModule {
  // configure(consumer: MiddlewareConsumer) {
  //   consumer
  //     .apply(TenantMiddleware)
  //     .forRoutes({ path: '*', method: RequestMethod.ALL });
  // }
}

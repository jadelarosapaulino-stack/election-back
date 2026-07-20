import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { SmsPlan } from './entities/sms-plan.entity';
import { SmsPlansService } from './sms-plans.service';
import { SmsPlansController } from './sms-plans.controller';
import { PlivoService } from './plivo.service';

@Module({
  imports: [TypeOrmModule.forFeature([SmsPlan]), ConfigModule],
  controllers: [SmsPlansController],
  providers: [SmsPlansService, PlivoService],
})
export class SmsPlansModule {}

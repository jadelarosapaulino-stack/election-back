import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TwilioConfig } from './entities/twilio-config.entity';
import { TwilioService } from './twilio.service';
import { TwilioController } from './twilio.controller';
import { Aes256GcmService } from '../common/security/aes-256-gcm.service';

@Module({
  imports: [TypeOrmModule.forFeature([TwilioConfig])],
  controllers: [TwilioController],
  providers: [TwilioService, Aes256GcmService],
})
export class TwilioModule {}

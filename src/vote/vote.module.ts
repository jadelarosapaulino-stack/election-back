import { OptionsModule } from './../options/options.module';
import { Module } from '@nestjs/common';
import { VoteService } from './vote.service';
import { VoteController } from './vote.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vote } from './entities/vote.entity';
import { SharedModule } from 'src/utils/shared.module';
import { TimelineModule } from 'src/timeline/timeline.module';
import { AuthModule } from 'src/auth/auth.module';
import { RealtimeModule } from 'src/realtime/realtime.module';
import { Aes256GcmService } from 'src/common/security/aes-256-gcm.service';
import { VoteEncryptionBackfillService } from './vote-encryption-backfill.service';

@Module({
  controllers: [VoteController],
  imports: [OptionsModule, TimelineModule, RealtimeModule, SharedModule, AuthModule, TypeOrmModule.forFeature([Vote])],
  providers: [VoteService, Aes256GcmService, VoteEncryptionBackfillService],
  exports: [VoteService, TypeOrmModule],
})
export class VoteModule {}

import { OptionsModule } from './../options/options.module';
import { Module } from '@nestjs/common';
import { VoteService } from './vote.service';
import { VoteController } from './vote.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vote } from './entities/vote.entity';
import { SharedModule } from 'src/utils/shared.module';
import { TimelineModule } from 'src/timeline/timeline.module';

@Module({
  controllers: [VoteController],
  imports: [OptionsModule, TimelineModule, SharedModule, TypeOrmModule.forFeature([Vote])],
  providers: [VoteService],
  exports: [VoteService, TypeOrmModule],
})
export class VoteModule {}

import { TimelineModule } from 'src/timeline/timeline.module';
import { OptionsModule } from './../options/options.module';
import { forwardRef, Module } from '@nestjs/common';
import { VotersService } from './voters.service';
import { VotersController } from './voters.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Voter } from './entities/voter.entity';
import { UtilsService } from 'src/utils/utils.service';
import { Vote } from 'src/vote/entities/vote.entity';
import { ElectionsModule } from 'src/elections/elections.module';

@Module({
  controllers: [VotersController],
  imports: [forwardRef( () => ElectionsModule), TimelineModule, OptionsModule, TypeOrmModule.forFeature([Voter, Vote])],
  providers: [VotersService, UtilsService],
  exports: [VotersService],
})
export class VotersModule {}

import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Election } from './entities/election.entity';
import { ElectionImgs } from './entities/election-image.entity';
import { Options } from 'src/options/entities/option.entity';
import { Voter } from 'src/voters/entities/voter.entity';
import { Vote } from 'src/vote/entities/vote.entity';
import { User } from 'src/auth/entities/user.entity';
import { ElectionsService } from './elections.service';
import { ElectionsController } from './elections.controller';
import { VotersModule } from './../voters/voters.module';
import { QuestionsModule } from 'src/questions/questions.module';
import { AuthModule } from 'src/auth/auth.module';
import { ElectionConfigService } from './election-config/election-config.service';
import { ElectionConfigController } from './election-config/election-config.controller';
import { ElectionConfig } from './election-config/entities/election-config.entity';
import { ElectionStatusJob } from './election-status.job';
import { ElectionConfigLockGuard } from './guards/election-config-lock.guard';
import { TimelineModule } from 'src/timeline/timeline.module';
import { ElectionMembership } from './entities/election-membership.entity';

@Module({
  imports: [
    forwardRef(() => VotersModule),
    forwardRef(() => QuestionsModule),
    TypeOrmModule.forFeature([Election, ElectionImgs, ElectionConfig, ElectionMembership, Options, Vote, Voter, User]),
    AuthModule,
    TimelineModule
  ],
  controllers: [ElectionsController, ElectionConfigController],
  providers: [
    ElectionsService,
    ElectionConfigService,
    ElectionStatusJob,
    ElectionConfigLockGuard,
  ],
  exports: [
    ElectionsService,
    ElectionConfigService,
    TypeOrmModule.forFeature([Election, ElectionImgs, ElectionConfig, ElectionMembership, Options, Vote, Voter, User]), // Importante exportar con las entidades
  ],
})
export class ElectionsModule {}

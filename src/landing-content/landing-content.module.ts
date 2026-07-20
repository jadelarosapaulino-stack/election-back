import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LandingContent } from './landing-content.entity';
import { LandingContentService } from './landing-content.service';
import { LandingContentController } from './landing-content.controller';
import { AuthModule } from 'src/auth/auth.module';
import { Election } from 'src/elections/entities/election.entity';
import { Voter } from 'src/voters/entities/voter.entity';
import { Vote } from 'src/vote/entities/vote.entity';

@Module({
  imports: [TypeOrmModule.forFeature([LandingContent, Election, Voter, Vote]), AuthModule],
  controllers: [LandingContentController],
  providers: [LandingContentService],
  exports: [LandingContentService],
})
export class LandingContentModule {}

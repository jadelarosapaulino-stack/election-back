import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Election } from './entities/election.entity';
import { ElectionImgs } from './entities/election-image.entity';
import { ElectionsService } from './elections.service';
import { ElectionsController } from './elections.controller';
import { VotersModule } from './../voters/voters.module';
import { QuestionsModule } from 'src/questions/questions.module';
import { AuthModule } from 'src/auth/auth.module';
import { ElectionConfigService } from './election-config/election-config.service';
import { ElectionConfigController } from './election-config/election-config.controller';
import { ElectionConfig } from './election-config/entities/election-config.entity';

@Module({
  imports: [
    forwardRef(() => VotersModule),
    forwardRef(() => QuestionsModule),
    TypeOrmModule.forFeature([Election, ElectionImgs, ElectionConfig]),
    AuthModule
  ],
  controllers: [ElectionsController, ElectionConfigController],
  providers: [ElectionsService, ElectionConfigService],
  exports: [
    ElectionsService,
    ElectionConfigService,
    TypeOrmModule.forFeature([Election, ElectionImgs, ElectionConfig]), // Importante exportar con las entidades
  ],
})
export class ElectionsModule {}

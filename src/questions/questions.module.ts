import { AuthModule } from './../auth/auth.module';
import { Options } from 'src/options/entities/option.entity';
import { Module } from '@nestjs/common';
import { QuestionsService } from './questions.service';
import { QuestionsController } from './questions.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Question } from './entities/question.entity';
import { QuestionsImgs } from './entities/question-image.entity';
import { TenantsModule } from 'src/tenants/user-settings.module';

@Module({
  controllers: [QuestionsController],
  providers: [QuestionsService],
  imports: [AuthModule,TenantsModule, TypeOrmModule.forFeature([Question, QuestionsImgs, Options])],
  exports: [QuestionsService, TypeOrmModule],
})
export class QuestionsModule {}

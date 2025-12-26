import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { Options } from 'src/options/entities/option.entity';
import { QuestionType } from 'src/utils/question-type.enum';

export class CreateQuestionDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsString()
  election: string;

  @IsEnum(QuestionType)
  type: QuestionType;

  @IsNumber()
  order: number;

  @IsArray()
  @IsOptional()
  options: Options[];
}

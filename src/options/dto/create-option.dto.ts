import {
  IsEnum,
  IsNumber,
  IsString,
} from 'class-validator';
import { Question } from 'src/questions/entities/question.entity';
import { OptionType } from 'src/utils/option-type.enum';

export class CreateOptionDto {
  @IsString()
  title: string;

  @IsString()
  description?: string;

  @IsNumber()
  order?: number;

  @IsString()
  question: Question;

  @IsString()
  images?: string;

  @IsString()
  files?: string;

  @IsEnum(OptionType)
  type?: OptionType;
}

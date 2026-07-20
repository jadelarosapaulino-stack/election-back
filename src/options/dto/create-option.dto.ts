import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { Question } from 'src/questions/entities/question.entity';
import { OptionType } from 'src/utils/option-type.enum';

export class CreateOptionDto {
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  order?: number;

  @IsString()
  question: Question;

  @IsString()
  @IsOptional()
  images?: string;

  @IsString()
  @IsOptional()
  files?: string;

  @IsEnum(OptionType)
  type?: OptionType;
}

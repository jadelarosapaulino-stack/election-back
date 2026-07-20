import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { StatusType } from 'src/utils/status-type.enum';

export class CreateElectionDto {
  @IsString()
  @MinLength(3)
  title: string;

  @IsString()
  @MinLength(10)
  description: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsEnum(StatusType)
  @IsOptional()
  status?: StatusType;

  // @IsString({ each: true })
  // @IsArray()
  // @IsOptional()
  // images?: string[];

  // @IsString({ each: true })
  // @IsArray()
  // @IsOptional()
  // options?: string[];
}

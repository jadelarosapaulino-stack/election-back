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

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsEnum({ type: 'enum', enum: StatusType, default: StatusType.ACTIVWE })
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

import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  MinLength,
  Min,
} from 'class-validator';

export class CreateSmsPlanDto {
  @IsString()
  @MinLength(2)
  code: string;

  @IsString()
  @MinLength(2)
  name: string;

  @IsInt()
  @IsPositive()
  smsLimit: number;

  @IsInt()
  @Min(0)
  unitAmount: number;

  @IsString()
  @Matches(/^[a-zA-Z]{3}$/)
  currency: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

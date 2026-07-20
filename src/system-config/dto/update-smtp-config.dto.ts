import {
  IsOptional,
  IsBoolean,
  IsString,
  IsInt,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateSmtpConfigDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  host?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  port?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  user?: string;

  @IsOptional()
  @IsString()
  pass?: string;

  @IsOptional()
  @IsBoolean()
  secure?: boolean;

  @IsOptional()
  @IsBoolean()
  requireTls?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  fromName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  fromEmail?: string;
}

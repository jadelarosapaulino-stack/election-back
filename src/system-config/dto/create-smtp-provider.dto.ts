import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const SMTP_PROVIDER_TYPES = [
  'custom',
  'resend',
  'postmark',
  'mailjet',
  'amazon_ses',
  'google',
] as const;

export class CreateSmtpProviderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsIn(SMTP_PROVIDER_TYPES)
  providerType?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  host: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  port: number;

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

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  fromName: string;

  @IsEmail()
  @MaxLength(255)
  fromEmail: string;
}

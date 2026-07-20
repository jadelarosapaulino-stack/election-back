import { IsArray, IsOptional, IsString, ArrayNotEmpty } from 'class-validator';

export class RegisterCookieConsentDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  categories: string[]; // ['necessary', 'analytics', 'functional']

  @IsString()
  version: string;

  @IsString()
  @IsOptional()
  ipAddress?: string;
}

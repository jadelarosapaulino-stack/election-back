import { IsBoolean, IsOptional, IsString, IsUrl } from 'class-validator';

export class UpdateTwilioConfigDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  useSandbox?: boolean;

  @IsOptional()
  @IsString()
  accountSid?: string;

  @IsOptional()
  @IsString()
  authToken?: string;

  @IsOptional()
  @IsString()
  messagingServiceSid?: string | null;

  @IsOptional()
  @IsString()
  verifyServiceSid?: string | null;

  @IsOptional()
  @IsString()
  fromNumber?: string | null;

  @IsOptional()
  @IsString()
  statusCallbackUrl?: string | null;

  @IsOptional()
  @IsString()
  defaultCountryCode?: string;
}

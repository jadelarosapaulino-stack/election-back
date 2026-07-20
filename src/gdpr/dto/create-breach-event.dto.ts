import { IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateBreachEventDto {
  @IsString()
  type: string;

  @IsString()
  description: string;

  @IsInt()
  @Min(0)
  affectedUsers: number;

  @IsEnum(['low', 'medium', 'high', 'critical'])
  severity: 'low' | 'medium' | 'high' | 'critical';

  @IsString()
  @IsOptional()
  detectedBy?: string;

  @IsArray()
  @IsString({ each: true })
  dataCategories: string[];

  @IsBoolean()
  requiresAuthorityNotification: boolean;

  @IsBoolean()
  requiresSubjectNotification: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  affectedUserEmails?: string[];
}

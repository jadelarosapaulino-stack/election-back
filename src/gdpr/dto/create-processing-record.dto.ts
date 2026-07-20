import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateProcessingRecordDto {
  @IsString()
  controllerName: string;

  @IsString()
  processingPurpose: string;

  @IsArray()
  @IsString({ each: true })
  dataCategories: string[];

  @IsArray()
  @IsString({ each: true })
  dataSubjects: string[];

  @IsString()
  legalBasis: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  recipients?: string[];

  @IsString()
  retentionPeriod: string;

  @IsBoolean()
  @IsOptional()
  transferOutsideEU?: boolean;

  @IsString()
  @IsOptional()
  transferSafeguards?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

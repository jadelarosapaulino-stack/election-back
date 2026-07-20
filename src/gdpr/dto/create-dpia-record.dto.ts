import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreateDpiaRecordDto {
  @IsString()
  processName: string;

  @IsString()
  description: string;

  @IsString()
  legalBasis: string;

  @IsArray()
  @IsString({ each: true })
  dataCategories: string[];

  @IsString()
  necessityAndProportionality: string;

  @IsString()
  risksToDataSubjects: string;

  @IsString()
  measuresToAddressRisks: string;

  @IsString()
  @IsOptional()
  reviewedBy?: string;

  @IsString()
  @IsOptional()
  approvalNotes?: string;
}

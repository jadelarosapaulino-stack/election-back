import { Transform } from 'class-transformer';
import { IsBoolean, IsDate, IsOptional, IsString } from 'class-validator';

export class CreateDpaRecordDto {
  @IsString()
  subprocessorName: string;

  @IsString()
  subprocessorEmail: string;

  @IsString()
  servicesProvided: string;

  @IsString()
  country: string;

  @IsBoolean()
  @IsOptional()
  outsideEU?: boolean;

  @IsString()
  @IsOptional()
  transferSafeguards?: string;

  @IsDate()
  @Transform(({ value }: { value: string }) => new Date(value))
  validFrom: Date;

  @IsDate()
  @IsOptional()
  @Transform(({ value }: { value: string }) =>
    value ? new Date(value) : value,
  )
  validUntil?: Date;

  @IsString()
  @IsOptional()
  dpaDocumentPath?: string;
}

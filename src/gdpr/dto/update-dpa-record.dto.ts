import { Transform } from 'class-transformer';
import { IsBoolean, IsDate, IsOptional, IsString } from 'class-validator';

export class UpdateDpaRecordDto {
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsDate()
  @IsOptional()
  @Transform(({ value }: { value: string }) =>
    value ? new Date(value) : value,
  )
  validUntil?: Date;

  @IsString()
  @IsOptional()
  dpaDocumentPath?: string;

  @IsString()
  @IsOptional()
  transferSafeguards?: string;
}

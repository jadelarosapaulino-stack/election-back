import { IsEnum, IsOptional, IsString } from 'class-validator';
import type { DpiaStatus } from '../dpia-record.entity';

const DPIA_STATUS_VALUES = [
  'draft',
  'in_review',
  'approved',
  'rejected',
  'needs_update',
] as const;

export class UpdateDpiaRecordDto {
  @IsEnum(DPIA_STATUS_VALUES)
  @IsOptional()
  status?: DpiaStatus;

  @IsString()
  @IsOptional()
  reviewedBy?: string;

  @IsString()
  @IsOptional()
  approvalNotes?: string;
}

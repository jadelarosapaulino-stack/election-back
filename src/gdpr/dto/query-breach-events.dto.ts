import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryBreachEventsDto {
  @IsEnum(['low', 'medium', 'high', 'critical'])
  @IsOptional()
  severity?: string;

  @IsEnum([
    'detected',
    'investigating',
    'notified_authority',
    'notified_subjects',
    'resolved',
    'closed',
  ])
  @IsOptional()
  status?: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  page?: number;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  limit?: number;
}

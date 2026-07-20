import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { PlanPurchaseStatus } from '../entities/plan-purchase.entity';

export class RecordPlanPurchaseDto {
  @IsString()
  planId!: string;

  @IsOptional()
  @IsString()
  priceId?: string;

  @IsOptional()
  @IsString()
  stripeSessionId?: string;

  @IsOptional()
  @IsString()
  stripeEventId?: string;

  @IsOptional()
  @IsString()
  stripeCustomerId?: string;

  @IsOptional()
  @IsString()
  stripeSubscriptionId?: string;

  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  capacity?: number;

  @IsOptional()
  @IsEnum(PlanPurchaseStatus)
  status?: PlanPurchaseStatus;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsUUID()
  electionId?: string;
}

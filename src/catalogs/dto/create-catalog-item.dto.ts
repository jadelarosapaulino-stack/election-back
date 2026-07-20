import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateCatalogItemDto {
  @IsString()
  @MinLength(2)
  groupKey: string;

  @IsString()
  @MinLength(1)
  code: string;

  @IsString()
  @MinLength(1)
  label: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

import { IsBoolean, IsInt, IsObject, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateLandingContentDto {
  @IsString()
  @MinLength(1)
  pageSlug: string;

  @IsString()
  @MinLength(1)
  pageTitle: string;

  @IsObject()
  content: Record<string, unknown>;

  @IsString()
  @IsOptional()
  metaTitle?: string;

  @IsString()
  @IsOptional()
  metaDescription?: string;

  @IsString()
  @IsOptional()
  parentId?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  @IsString()
  @IsOptional()
  status?: 'draft' | 'published' | 'archived';

  @IsString()
  @IsOptional()
  template?: string;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsBoolean()
  @IsOptional()
  isNavVisible?: boolean;
}

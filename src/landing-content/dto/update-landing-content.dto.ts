import { IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateLandingContentDto {
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
}

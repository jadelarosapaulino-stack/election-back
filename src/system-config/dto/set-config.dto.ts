import { IsNotEmpty, IsString, IsOptional, MaxLength } from 'class-validator';

export class SetConfigDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  group!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  key!: string;

  @IsString()
  value!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

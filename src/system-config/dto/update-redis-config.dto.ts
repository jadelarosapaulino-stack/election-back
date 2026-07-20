import { IsOptional, IsString, IsInt, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateRedisConfigDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  host?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  port?: number;

  @IsOptional()
  @IsString()
  password?: string;
}

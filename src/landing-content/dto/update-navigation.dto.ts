import { IsArray, ValidateNested, IsString, IsInt, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class NavigationItemDto {
  @IsString()
  id: string;

  @IsInt()
  sortOrder: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NavigationItemDto)
  children?: NavigationItemDto[];
}

export class UpdateNavigationDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NavigationItemDto)
  navigation: NavigationItemDto[];
}

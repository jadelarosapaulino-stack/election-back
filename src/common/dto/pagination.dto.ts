import { Type } from "class-transformer";
import { IsOptional, IsPositive, IsString } from "class-validator";
import { Any } from "typeorm";

export class PaginationDto {

    @IsOptional()
    @IsPositive()
    @Type( () => Number)
    limit?: number;

    @IsOptional()
    @Type( () => Number)
    offset?: number;

    @IsOptional()
    @Type( () => Any)
    ordertype?: any;

    
    @IsOptional()
    @IsString()
    search?: string;;
}
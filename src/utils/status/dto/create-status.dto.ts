import { IsString, MinLength } from "class-validator";

export class CreateStatusDto {
      @IsString()
      @MinLength(3)
      title: string;
    
      @IsString()
      @MinLength(5)
      color: string;
}

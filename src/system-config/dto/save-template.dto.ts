import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SaveTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  subject!: string;

  @IsString()
  @IsNotEmpty()
  htmlBody!: string;
}

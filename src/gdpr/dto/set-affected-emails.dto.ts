import { IsArray, IsEmail, IsNotEmpty } from 'class-validator';

export class SetAffectedEmailsDto {
  @IsArray()
  @IsNotEmpty()
  @IsEmail({}, { each: true })
  emails: string[];
}

import { IsEmail, IsOptional, MaxLength } from 'class-validator';

export class TestSmtpDto {
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  recipient?: string;
}

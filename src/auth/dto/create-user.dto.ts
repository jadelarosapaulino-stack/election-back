import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  @MaxLength(50)
  @Matches(/(?:(?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'The password must have a Uppercase, lowercase letter and a number',
  })
  password: string;

  @IsString()
  @MinLength(1)
  fullName: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  organization?: string;

  @IsBoolean()
  @IsNotEmpty()
  acceptedPrivacyPolicy: boolean;

  @IsString()
  @IsOptional()
  privacyPolicyVersion?: string;
}

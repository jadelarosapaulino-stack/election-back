import { IsEmail, IsObject, IsOptional, IsString } from 'class-validator';
import { Election } from 'src/elections/entities/election.entity';

export class CreateVoterDto {
  @IsString()
  name: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  election: Election;

  @IsString()
  identifier?: string;

  @IsString()
  password?: string;

  @IsOptional()
  @IsObject()
  metadata: any;
}
